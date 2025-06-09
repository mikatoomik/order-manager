import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, Typography, Box, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress } from '@mui/material';
import type { User } from '@supabase/supabase-js';
import type { Period } from '../utils/periodUtils';
import type { UserCircle } from '../types';

interface PeriodesPageProps {
  user: User;
}

const ETATS = ['open', 'ordered', 'closed', 'archived'];

export default function PeriodesPage({ user }: PeriodesPageProps) {
  const [periodes, setPeriodes] = useState<Period[]>([]);
  const [isFinAdmin, setIsFinAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newDateLimite, setNewDateLimite] = useState('');
  const [commandeModalOpen, setCommandeModalOpen] = useState<string | null>(null); // id de la période sélectionnée
  const [commandeArticles, setCommandeArticles] = useState<ArticleCommande[]>([]); // articles agrégés pour la période
  const [commandeLoading, setCommandeLoading] = useState(false);
  const [commandeQuantites, setCommandeQuantites] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchPeriodes();
    checkFinAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPeriodes() {
    const { data, error } = await supabase
      .from('order_periods')
      .select('*')
      .order('date_limite', { ascending: false });
    if (error) setError('Erreur lors du chargement des périodes');
    setPeriodes(data || []);
  }

  async function checkFinAdmin() {
    const { data, error } = await supabase
      .from('user_circles')
      .select('circles(id, nom)')
      .eq('user_id', user.id);
    if (error) return setIsFinAdmin(false);
    const circles: UserCircle[] = (data || [])
      .map((item: { circles: UserCircle[] | UserCircle }) => Array.isArray(item.circles) ? item.circles[0] : item.circles)
      .filter(Boolean);
    setIsFinAdmin(circles.some((c) => c.nom === 'FinAdmin'));
  }

  async function creerPeriode() {
    setError(null); setSuccess(null);
    if (!newNom || !newDateLimite) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await supabase
      .from('order_periods')
      .insert([{ nom: newNom, date_limite: newDateLimite, status: 'open' }]);
    if (error) setError('Erreur lors de la création');
    else {
      setSuccess('Période créée');
      setOpenModal(false);
      setNewNom('');
      setNewDateLimite('');
      fetchPeriodes();
    }
  }

  async function changerEtat(id: string, status: string) {
    setError(null); setSuccess(null);
    const { error } = await supabase
      .from('order_periods')
      .update({ status })
      .eq('id', id);
    if (error) setError('Erreur lors du changement d\'état');
    else { setSuccess('État modifié'); fetchPeriodes(); }
  }

  // Fonction pour ouvrir la modale et charger les articles agrégés
  async function ouvrirCommandeModal(periodeId: string) {
    setCommandeModalOpen(periodeId);
    setCommandeLoading(true);
    // Récupérer toutes les commandes (circle_requests) pour cette période
    const { data: requests, error } = await supabase
      .from('circle_requests')
      .select(`id, status, request_lines(id, qty, articles(id, libelle, ref, fournisseur, prix_unitaire, url))`)
      .eq('period_id', periodeId)
      .neq('status', 'draft');
    if (error) {
      setError('Erreur lors du chargement des commandes');
      setCommandeLoading(false);
      return;
    }
    // Agréger les articles sur toutes les lignes de toutes les commandes
    const articlesMap: Record<string, ArticleCommande> = {};
    (requests || []).forEach(req => {
      (req.request_lines || []).forEach(line => {
        const art = Array.isArray(line.articles) ? line.articles[0] : line.articles;
        if (!art) return;
        if (!articlesMap[art.id]) {
          articlesMap[art.id] = { ...art, quantite: 0 };
        }
        articlesMap[art.id].quantite += line.qty;
      });
    });
    const articles = Object.values(articlesMap);
    setCommandeArticles(articles);
    setCommandeQuantites(Object.fromEntries(articles.map(a => [a.id, a.quantite])));
    setCommandeLoading(false);
  }

  // Fonction pour valider la commande (passe la période à 'ordered' et met à jour les quantités validées)
  async function validerCommande() {
    if (!commandeModalOpen) return;
    setCommandeLoading(true);
    setError(null); setSuccess(null);
    // 1. Mettre à jour les quantités validées dans request_lines pour chaque article
    try {
      // Récupérer toutes les commandes circle_requests de la période
      const { data: requests, error: reqError } = await supabase
        .from('circle_requests')
        .select('id, request_lines(id, article_id)')
        .eq('period_id', commandeModalOpen)
        .neq('status', 'draft');
      if (reqError) throw reqError;
      // Pour chaque ligne de chaque commande, si l'article est dans la liste, mettre à jour qty_validated
      for (const req of requests || []) {
        for (const line of req.request_lines || []) {
          const qte = commandeQuantites[line.article_id];
          if (typeof qte === 'number') {
            await supabase
              .from('request_lines')
              .update({ qty_validated: qte })
              .eq('id', line.id);
          }
        }
      }
      // 2. Mettre à jour la période
      const { error } = await supabase
        .from('order_periods')
        .update({ status: 'ordered' })
        .eq('id', commandeModalOpen);
      if (error) setError('Erreur lors de la validation de la commande');
      else {
        setSuccess('Commande validée, la période passe à "ordered"');
        setCommandeModalOpen(null);
        fetchPeriodes();
      }
    } catch (e) {
      setError('Erreur lors de la validation des quantités');
    }
    setCommandeLoading(false);
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Périodes de commande</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {isFinAdmin && (
        <Button variant="contained" color="primary" sx={{ mb: 2 }} onClick={() => setOpenModal(true)}>
          Créer une nouvelle période
        </Button>
      )}
      <Dialog open={openModal} onClose={() => setOpenModal(false)}>
        <DialogTitle>Créer une nouvelle période</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la période"
            fullWidth
            value={newNom}
            onChange={e => setNewNom(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Date limite"
            type="date"
            fullWidth
            value={newDateLimite}
            onChange={e => setNewDateLimite(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Annuler</Button>
          <Button onClick={creerPeriode} variant="contained">Créer</Button>
        </DialogActions>
      </Dialog>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Date limite</TableCell>
              <TableCell>État</TableCell>
              {isFinAdmin && <TableCell>Actions</TableCell>}
              {isFinAdmin && <TableCell>Commande</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {periodes
              .sort((a, b) => new Date(b.date_limite).getTime() - new Date(a.date_limite).getTime())
              .map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nom}</TableCell>
                  <TableCell>{p.date_limite}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  {isFinAdmin && (
                    <TableCell>
                      <Select
                        value={p.status}
                        onChange={e => changerEtat(p.id, e.target.value)}
                        size="small"
                      >
                        {ETATS.map(etat => <MenuItem key={etat} value={etat}>{etat}</MenuItem>)}
                      </Select>
                    </TableCell>
                  )}
                  {isFinAdmin && p.status === 'open' && (
                    <TableCell>
                      <Button variant="outlined" size="small" onClick={() => ouvrirCommandeModal(p.id)}>
                        Passer la commande
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Modale commande */}
      <Dialog open={!!commandeModalOpen} onClose={() => setCommandeModalOpen(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Passer la commande</DialogTitle>
        <DialogContent>
          {commandeLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
          ) : commandeArticles.length === 0 ? (
            <Typography>Aucun article à commander pour cette période.</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Référence</TableCell>
                    <TableCell>Libellé</TableCell>
                    <TableCell>Fournisseur</TableCell>
                    <TableCell>Prix unitaire</TableCell>
                    <TableCell>Quantité</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Lien</TableCell>
                    <TableCell>Confirmer</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {commandeArticles.map(art => (
                    <TableRow key={art.id}>
                      <TableCell>{art.ref}</TableCell>
                      <TableCell>{art.libelle}</TableCell>
                      <TableCell>{art.fournisseur}</TableCell>
                      <TableCell>{art.prix_unitaire} €</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Button size="small" onClick={() => setCommandeQuantites(q => ({ ...q, [art.id]: Math.max(0, (q[art.id] ?? art.quantite) - 1) }))}>-</Button>
                          <TextField
                            type="number"
                            size="small"
                            value={commandeQuantites[art.id] ?? art.quantite}
                            onChange={e => setCommandeQuantites(q => ({ ...q, [art.id]: Math.max(0, Number(e.target.value)) }))}
                            inputProps={{ min: 0, style: { width: 60 } }}
                          />
                          <Button size="small" onClick={() => setCommandeQuantites(q => ({ ...q, [art.id]: (q[art.id] ?? art.quantite) + 1 }))}>+</Button>
                        </Box>
                      </TableCell>
                      <TableCell>{(art.prix_unitaire * (commandeQuantites[art.id] || art.quantite)).toFixed(2)} €</TableCell>
                      <TableCell>{art.url ? <a href={art.url} target="_blank" rel="noopener noreferrer">Lien</a> : ''}</TableCell>
                      <TableCell>
                        <Button variant="contained" size="small" color="success" disabled>
                          Confirmer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommandeModalOpen(null)}>Annuler</Button>
          <Button variant="contained" color="primary" onClick={validerCommande}>Valider</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Remplacer 'any' par un type ArticleCommande pour plus de clarté
interface ArticleCommande {
  id: string;
  libelle: string;
  ref: string;
  fournisseur: string;
  prix_unitaire: number;
  url?: string;
  quantite: number;
}
