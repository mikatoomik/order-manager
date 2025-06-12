import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, TextField, Button, Alert, CircularProgress, Divider } from '@mui/material';
import dayjs from 'dayjs';

interface ArticleCommande {
  id: string;
  libelle: string;
  ref: string;
  quantite: number;
  delivery_date?: string;
  period_id?: string;
  period_nom?: string;
}

export default function ReceptionCommandePage({ user }: { user: User }) {
  const params = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleCommande[]>([]);
  const [infos, setInfos] = useState<Record<string, { status: 'total' | 'partial' | 'none', qty: number, comment: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Record<string, { id: string, nom: string }>>({});

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      setError(null);
      type RequestLine = { 
        id: string; 
        qty_validated?: number; 
        delivery_date?: string; 
        article_id: string;
        articles: { id: string; libelle: string; ref: string } | { id: string; libelle: string; ref: string }[] 
      };
      type Request = { 
        id: string; 
        period_id: string;
        request_lines: RequestLine[] 
      };
      
      // Récupérer toutes les périodes ordered
      const { data: periodsData } = await supabase
        .from('order_periods')
        .select('id, nom')
        .eq('status', 'ordered');
      
      const periodIds = (periodsData as { id: string, nom: string }[] | null)?.map(p => p.id) || [];
      const periodsMap = Object.fromEntries(
        (periodsData as { id: string, nom: string }[] | null || []).map(p => [p.id, { id: p.id, nom: p.nom }])
      );
      setPeriods(periodsMap);
      
      if (periodIds.length === 0) {
        setLoading(false);
        return;
      }

      // Récupérer toutes les commandes pour ces périodes
      const { data, error } = await supabase
        .from('circle_requests')
        .select('id, period_id, request_lines(id, qty_validated, delivery_date, article_id, articles(id, libelle, ref))')
        .in('period_id', periodIds)
        .neq('status', 'draft');

      if (error) {
        setError('Erreur lors du chargement des commandes');
        setLoading(false);
        return;
      }

      const requests = data as Request[] || [];
      const articlesMap: Record<string, ArticleCommande> = {};
      
      // Regrouper les articles par ID et date de livraison
      (requests || []).forEach(req => {
        (req.request_lines || []).forEach((line: RequestLine) => {
          const art = Array.isArray(line.articles) ? line.articles[0] : line.articles;
          if (!art) return;
          
          // Créer une clé unique pour chaque combinaison article/date de livraison
          const key = `${art.id}_${line.delivery_date || 'no_date'}`;
          
          if (!articlesMap[key]) {
            articlesMap[key] = { 
              ...art, 
              quantite: 0, 
              delivery_date: line.delivery_date,
              period_id: req.period_id,
              period_nom: periodsMap[req.period_id]?.nom
            };
          }
          articlesMap[key].quantite += line.qty_validated ?? 0;
        });
      });
      
      // Convertir en tableau et trier par date de livraison
      let arts = Object.values(articlesMap);
      arts.sort((a, b) => {
        // Articles sans date en dernier
        if (!a.delivery_date && !b.delivery_date) return 0;
        if (!a.delivery_date) return 1;
        if (!b.delivery_date) return -1;
        // Sinon par date croissante
        return a.delivery_date.localeCompare(b.delivery_date);
      });
      
      setArticles(arts);
      setInfos(Object.fromEntries(arts.map(a => [
        `${a.id}_${a.delivery_date || 'no_date'}`, 
        { status: 'total', qty: a.quantite, comment: '' }
      ])));
      setLoading(false);
    }
    fetchArticles();
  }, []);

  async function oldvaliderReception() {
    setLoading(true);
    setError(null); 
    setSuccess(null);
    try {
      // Pour chaque article, mettre à jour les request_lines correspondantes
      for (const art of articles) {
        const key = `${art.id}_${art.delivery_date || 'no_date'}`;
        const info = infos[key];
        if (!info) continue;
        
        // Récupérer toutes les request_lines pour cet article et cette date
        const { data: lines } = await supabase
          .from('request_lines')
          .select('id')
          .eq('article_id', art.id)
          .eq(art.delivery_date ? 'delivery_date' : 'id', art.delivery_date || 'no_date')
          .in('circle_requests.period_id', [art.period_id])
          .neq('circle_requests.status', 'draft');
        
        // Mettre à jour chaque ligne
        for (const line of lines || []) {
          await supabase
            .from('request_lines')
            .update({
              reception_status: info.status,
              qty_received: info.status === 'total' ? info.qty : (info.status === 'partial' ? info.qty : 0),
              reception_comment: info.comment,
              reception_date: new Date().toISOString(),
              reception_user: user.email
            })
            .eq('id', line.id);
        }
      }
      
      // Vérifier si toutes les périodes peuvent être clôturées
      const periodStatus: Record<string, boolean> = {};
      for (const art of articles) {
        if (!art.period_id) continue;
        const key = `${art.id}_${art.delivery_date || 'no_date'}`;
        const info = infos[key];
        if (info?.status !== 'total') {
          periodStatus[art.period_id] = false;
        } else if (periodStatus[art.period_id] !== false) {
          periodStatus[art.period_id] = true;
        }
      }
      
      // Mettre à jour le statut des périodes
      for (const [periodId, allTotal] of Object.entries(periodStatus)) {
        await supabase
          .from('order_periods')
          .update({ status: allTotal ? 'closed' : 'ordered' })
          .eq('id', periodId);
      }
      
      setSuccess('Réception enregistrée.');
      setTimeout(() => navigate('/commandes'), 1500);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la validation de la réception');
    }
    setLoading(false);
  }
  async function validerReception() {
    setLoading(true);
    setError(null); 
    setSuccess(null);
    try {
      // Pour chaque article, mettre à jour les request_lines correspondantes
      for (const art of articles) {
        const key = `${art.id}_${art.delivery_date || 'no_date'}`;
        const info = infos[key];
        if (!info) continue;
        
        // Récupérer toutes les request_lines pour cet article et cette date
        const { data: lines } = await supabase
          .from('request_lines')
          .select('id, request_id')
          .eq('article_id', art.id)
          .eq(art.delivery_date ? 'delivery_date' : 'id', art.delivery_date || 'no_date')
          .in('circle_requests.period_id', [art.period_id])
          .neq('circle_requests.status', 'draft');
        
        // Mettre à jour chaque ligne
        for (const line of lines || []) {
          await supabase
            .from('request_lines')
            .update({
              reception_status: info.status,
              qty_received: info.status === 'total' ? info.qty : (info.status === 'partial' ? info.qty : 0),
              reception_comment: info.comment,
              reception_date: new Date().toISOString(),
              reception_user: user.email
            })
            .eq('id', line.id);
        }
      }
      
      // Récupérer toutes les circle_requests concernées par cette réception
      const requestIds = new Set();
      for (const art of articles) {
        const { data: lines } = await supabase
          .from('request_lines')
          .select('request_id, circle_requests(period_id)')
          .eq('article_id', art.id)
          .eq(art.delivery_date ? 'delivery_date' : 'id', art.delivery_date || 'no_date')
          .in('circle_requests.period_id', [art.period_id])
          .neq('circle_requests.status', 'draft');
        
        (lines || []).forEach(line => {
          if (line.request_id) requestIds.add(line.request_id);
        });
      }
      
      // Pour chaque circle_request, déterminer son nouveau statut
      const periodRequestStatus: Record<string, { total: number, none: number, partial: number, mixed: number }> = {}; // Pour suivre les statuts par période
      
      for (const requestId of requestIds) {
        // Récupérer toutes les lignes de cette request
        const { data: requestLines } = await supabase
          .from('request_lines')
          .select('reception_status, circle_requests(period_id)')
          .eq('request_id', requestId);
        
        if (!requestLines || requestLines.length === 0) continue;
        
        // Déterminer le statut de la request
        const allTotal = requestLines.every(line => line.reception_status === 'total');
        const allNone = requestLines.every(line => line.reception_status === 'none' || !line.reception_status);
        const hasPartial = requestLines.some(line => line.reception_status === 'partial');
        const hasMixed = !allTotal && !allNone;
        
        let newStatus = 'validated'; // Par défaut
        if (allTotal) {
          newStatus = 'closed';
        } else if (hasMixed || hasPartial) {
          newStatus = 'waiting';
        }
        
        // Mettre à jour le statut de la request
        await supabase
          .from('circle_requests')
          .update({ status: newStatus })
          .eq('id', requestId);
        
        // Suivre les statuts par période pour la mise à jour des périodes
        const periodId = requestLines[0]?.circle_requests?.period_id;
        if (periodId) {
          if (!periodRequestStatus[periodId]) {
            periodRequestStatus[periodId] = { total: 0, none: 0, partial: 0, mixed: 0 };
          }
          
          if (allTotal) periodRequestStatus[periodId].total++;
          else if (allNone) periodRequestStatus[periodId].none++;
          else if (hasPartial) periodRequestStatus[periodId].partial++;
          else if (hasMixed) periodRequestStatus[periodId].mixed++;
        }
      }
      
      // Mettre à jour le statut des périodes
      for (const [periodId, status] of Object.entries(periodRequestStatus)) {
        let newPeriodStatus = 'ordered'; // Par défaut
        
        // Si toutes les requests sont closed
        if (status.total > 0 && status.none === 0 && status.partial === 0 && status.mixed === 0) {
          newPeriodStatus = 'closed';
        }
        // Si au moins une request est en waiting ou partial
        else if (status.partial > 0 || status.mixed > 0) {
          newPeriodStatus = 'waiting';
        }
        
        await supabase
          .from('order_periods')
          .update({ status: newPeriodStatus })
          .eq('id', periodId);
      }
      
      setSuccess('Réception enregistrée.');
      setTimeout(() => navigate('/commandes'), 1500);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la validation de la réception');
    }
    setLoading(false);
  }
  // Grouper les articles par date de livraison
  const articlesByDate: Record<string, ArticleCommande[]> = {};
  articles.forEach(art => {
    const dateKey = art.delivery_date || 'Sans date';
    if (!articlesByDate[dateKey]) {
      articlesByDate[dateKey] = [];
    }
    articlesByDate[dateKey].push(art);
  });

  // Trier les dates
  const sortedDates = Object.keys(articlesByDate).sort((a, b) => {
    if (a === 'Sans date') return 1;
    if (b === 'Sans date') return -1;
    return a.localeCompare(b);
  });

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>Réception des commandes</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
      ) : articles.length === 0 ? (
        <Typography>Aucun article à réceptionner.</Typography>
      ) : (
        <>
          {sortedDates.map(dateKey => (
            <Box key={dateKey} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                {dateKey === 'Sans date' ? 'Articles sans date de livraison prévue' : `Livraison prévue le ${dayjs(dateKey).format('DD/MM/YYYY')}`}
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Référence</TableCell>
                      <TableCell>Libellé</TableCell>
                      <TableCell>Période</TableCell>
                      <TableCell>Quantité commandée</TableCell>
                      <TableCell>Statut réception</TableCell>
                      <TableCell>Quantité reçue</TableCell>
                      <TableCell>Commentaire</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {articlesByDate[dateKey].map(art => {
                      const key = `${art.id}_${art.delivery_date || 'no_date'}`;
                      return (
                        <TableRow key={key}>
                          <TableCell>{art.ref}</TableCell>
                          <TableCell>{art.libelle}</TableCell>
                          <TableCell>{art.period_nom}</TableCell>
                          <TableCell>{art.quantite}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={infos[key]?.status || 'total'}
                              onChange={e => setInfos(info => ({
                                ...info,
                                [key]: {
                                  ...info[key],
                                  status: e.target.value as 'total' | 'partial' | 'none',
                                  qty: e.target.value === 'total' ? art.quantite : (e.target.value === 'none' ? 0 : info[key]?.qty || 0)
                                }
                              }))}
                            >
                              <MenuItem value="total">Reçu en totalité</MenuItem>
                              <MenuItem value="partial">Reçu partiellement</MenuItem>
                              <MenuItem value="none">Non reçu</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {infos[key]?.status === 'partial' ? (
                              <TextField
                                type="number"
                                size="small"
                                value={infos[key]?.qty || 0}
                                onChange={e => setInfos(info => ({
                                  ...info,
                                  [key]: { ...info[key], qty: Math.max(0, Math.min(Number(e.target.value), art.quantite)) }
                                }))}
                                inputProps={{ min: 0, max: art.quantite, style: { width: 60 } }}
                              />
                            ) : (
                              infos[key]?.status === 'total' ? art.quantite : 0
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={infos[key]?.comment || ''}
                              onChange={e => setInfos(info => ({
                                ...info,
                                [key]: { ...info[key], comment: e.target.value }
                              }))}
                              placeholder="Commentaire (facultatif)"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" color="primary" onClick={validerReception} disabled={loading}>
              Valider la réception
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}