import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress } from '@mui/material';
import type { User } from '@supabase/supabase-js';
import { periodStatusToLabel, type Period } from '../utils/periodUtils';
import type { UserCircle } from '../types';

interface PeriodesPageProps {
  user: User;
}

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
  const [confirmedArticles, setConfirmedArticles] = useState<Record<string, boolean>>({});
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [commandeLivraisons, setCommandeLivraisons] = useState<Record<string, string>>({}); // date de livraison estimée par article

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

  // Fonction pour ouvrir la modale et charger les articles agrégés
  async function ouvrirCommandeModal(periodeId: string) {
    setCommandeModalOpen(periodeId);
    setCommandeLoading(true);
    setConfirmedArticles({});
    setValidationWarning(null);
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
    setCommandeLivraisons(Object.fromEntries(articles.map(a => [a.id, ''])));
    setCommandeLoading(false);
  }

  // Fonction pour confirmer une ligne (article)
  const confirmerLigne = async (articleId: string) => {
    const qtyAjustee = commandeQuantites[articleId] ?? 0;
    const qtyOriginale = commandeArticles.find(a => a.id === articleId)?.quantite ?? 0;
    
    // Calculer le ratio d'ajustement
    const ratio = qtyOriginale > 0 ? qtyAjustee / qtyOriginale : 0;
    
    // Récupérer toutes les lignes de commande pour cet article
    const { data: requests } = await supabase
      .from('circle_requests')
      .select('id, request_lines(id, article_id, qty)')
      .eq('period_id', commandeModalOpen)
      .neq('status', 'draft');
    
    // Garder une trace des quantités déjà allouées
    let qtyRestante = qtyAjustee;
    const lignes = [];
    
    // Collecter toutes les lignes concernées
    for (const req of requests || []) {
      for (const line of req.request_lines || []) {
        if (line.article_id === articleId) {
          lignes.push({
            id: line.id,
            qty: line.qty
          });
        }
      }
    }
    
    // Trier les lignes par quantité (optionnel, pour prioriser les plus grandes commandes)
    lignes.sort((a, b) => b.qty - a.qty);
    
    // Distribuer proportionnellement la quantité ajustée
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      let qtyValidee;
      
      if (i === lignes.length - 1) {
        // Dernière ligne: attribuer le reste pour éviter les erreurs d'arrondi
        qtyValidee = qtyRestante;
      } else {
        // Calculer la quantité proportionnelle
        qtyValidee = Math.round(ligne.qty * ratio);
        // S'assurer qu'on ne dépasse pas la quantité restante
        qtyValidee = Math.min(qtyValidee, qtyRestante);
        qtyRestante -= qtyValidee;
      }
      
      // Mettre à jour la ligne
      await supabase
        .from('request_lines')
        .update({ 
          qty_validated: qtyValidee, 
          delivery_date: commandeLivraisons[articleId] || null 
        })
        .eq('id', ligne.id);
    }
    
    setConfirmedArticles(prev => ({ ...prev, [articleId]: true }));
  };

  // Fonction pour valider la commande (passe la période à 'ordered' et met à jour les quantités validées)
  async function validerCommande(force?: boolean) {
    if (!commandeModalOpen) return;
    setCommandeLoading(true);
    setError(null); setSuccess(null);
    // 1. Vérifier les lignes non confirmées
    const nonConfirmes = commandeArticles.filter(a => !confirmedArticles[a.id]);
    if (nonConfirmes.length > 0 && !force) {
      setValidationWarning('Attention, les articles suivants n\'ont pas été confirmés : ' + nonConfirmes.map(a => a.libelle).join(', ') + '.\nVous pouvez valider quand même ou annuler pour confirmer les lignes manquantes.');
      setCommandeLoading(false);
      return;
    }
    // 2. Mettre à jour les quantités validées dans request_lines pour chaque article non confirmé (qty_validated = 0)
    try {
      const { data: requests, error: reqError } = await supabase
        .from('circle_requests')
        .select('id, request_lines(id, article_id, qty_validated)')
        .eq('period_id', commandeModalOpen)
        .neq('status', 'draft');
      if (reqError) throw reqError;
      // Mettre à jour qty_validated à 0 pour les non confirmées
      for (const req of requests || []) {
        for (const line of req.request_lines || []) {
          if (!confirmedArticles[line.article_id]) {
            await supabase
              .from('request_lines')
              .update({ qty_validated: 0, delivery_date: null })
              .eq('id', line.id);
          }
        }
      }
      // Vérifier si toutes les lignes de toutes les commandes sont à 0
      let allZero = true;
      for (const req of requests || []) {
        for (const line of req.request_lines || []) {
          if ((typeof line.qty_validated === 'number' ? line.qty_validated : commandeQuantites[line.article_id]) > 0) {
            allZero = false;
            break;
          }
        }
        if (!allZero) break;
      }
      // 3. Mettre à jour la période
      const { error } = await supabase
        .from('order_periods')
        .update({ status: allZero ? 'closed' : 'ordered' })
        .eq('id', commandeModalOpen);
      if (error) setError('Erreur lors de la validation de la commande');
      else {
        setSuccess(allZero ? 'Aucune ligne validée, la période est clôturée.' : 'Commande validée, la période passe à "ordered"');
        setCommandeModalOpen(null);
        fetchPeriodes();
      }
    } catch {
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
            </TableRow>
          </TableHead>
          <TableBody>
            {periodes
              .sort((a, b) => new Date(b.date_limite).getTime() - new Date(a.date_limite).getTime())
              .map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nom}</TableCell>
                  <TableCell>{p.date_limite}</TableCell>
                  <TableCell>{periodStatusToLabel(p.status)}</TableCell>
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
      <Dialog open={!!commandeModalOpen} onClose={() => { setCommandeModalOpen(null); setValidationWarning(null); setConfirmedArticles({}); }} maxWidth="lg" fullWidth>
        <DialogTitle>Passer la commande</DialogTitle>
        <DialogContent>
          {validationWarning && (
            <Alert severity="warning" sx={{ mb: 2 }}>{validationWarning}</Alert>
          )}
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
                    <TableCell>Date livraison estimée</TableCell>
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
                        <TextField
                          type="date"
                          size="small"
                          value={commandeLivraisons[art.id] || ''}
                          onChange={e => setCommandeLivraisons(q => ({ ...q, [art.id]: e.target.value }))}
                          inputProps={{ style: { width: 130 } }}
                          sx={{ minWidth: 130 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={confirmedArticles[art.id] ? "contained" : "outlined"}
                          size="small"
                          color={confirmedArticles[art.id] ? "success" : "primary"}
                          onClick={() => confirmerLigne(art.id)}
                          disabled={confirmedArticles[art.id]}
                        >
                          {confirmedArticles[art.id] ? "Confirmé" : "Confirmer"}
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
          <Button onClick={() => { setCommandeModalOpen(null); setValidationWarning(null); setConfirmedArticles({}); }}>Annuler</Button>
          {validationWarning ? (
            <Button variant="contained" color="warning" onClick={() => { setValidationWarning(null); validerCommande(true); }}>
              Valider quand même
            </Button>
          ) : (
            <Button variant="contained" color="primary" onClick={() => validerCommande()}>
              Valider
            </Button>
          )}
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
