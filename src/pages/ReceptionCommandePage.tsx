import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, TextField, Button, Alert, CircularProgress } from '@mui/material';

interface ArticleCommande {
  id: string;
  libelle: string;
  ref: string;
  quantite: number;
}

export default function ReceptionCommandePage({ user, periodeId: propPeriodeId, deliveryDate }: { user: User, periodeId?: string, deliveryDate?: string }) {
  const params = useParams();
  const periodeId = propPeriodeId || params.periodeId;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleCommande[]>([]);
  const [infos, setInfos] = useState<Record<string, { status: 'total' | 'partial' | 'none', qty: number, comment: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      setError(null);
      type RequestLine = { id: string; qty_validated?: number; delivery_date?: string; articles: { id: string; libelle: string; ref: string } | { id: string; libelle: string; ref: string }[] };
      type Request = { id: string; request_lines: RequestLine[] };
      let periodIds: string[] = [];
      if (deliveryDate) {
        // Récupérer toutes les périodes ordered
        const { data: periodsData } = await supabase.from('order_periods').select('id').eq('status', 'ordered');
        periodIds = (periodsData as { id: string }[] | null)?.map(p => p.id) || [];
      }
      let requests: Request[] = [];
      if (deliveryDate) {
        const { data, error } = await supabase
          .from('circle_requests')
          .select('id, request_lines(id, qty_validated, delivery_date, articles(id, libelle, ref))')
          .in('period_id', periodIds)
          .neq('status', 'draft');
        if (error) {
          setError('Erreur lors du chargement des commandes');
          setLoading(false);
          return;
        }
        requests = (data as Request[] || []).map(req => ({
          ...req,
          request_lines: (req.request_lines || []).filter((line: RequestLine) => line.delivery_date === deliveryDate)
        }));
      } else if (periodeId) {
        const { data, error } = await supabase
          .from('circle_requests')
          .select('id, request_lines(id, qty_validated, articles(id, libelle, ref))')
          .eq('period_id', periodeId)
          .neq('status', 'draft');
        if (error) {
          setError('Erreur lors du chargement des commandes');
          setLoading(false);
          return;
        }
        requests = data as Request[] || [];
      }
      const articlesMap: Record<string, ArticleCommande> = {};
      (requests || []).forEach(req => {
        (req.request_lines || []).forEach((line: RequestLine) => {
          const art = Array.isArray(line.articles) ? line.articles[0] : line.articles;
          if (!art) return;
          if (!articlesMap[art.id]) {
            articlesMap[art.id] = { ...art, quantite: 0 };
          }
          articlesMap[art.id].quantite += line.qty_validated ?? 0;
        });
      });
      const arts = Object.values(articlesMap);
      setArticles(arts);
      setInfos(Object.fromEntries(arts.map(a => [a.id, { status: 'total', qty: a.quantite, comment: '' }])));
      setLoading(false);
    }
    fetchArticles();
  }, [periodeId, deliveryDate]);

  async function validerReception() {
    setLoading(true);
    setError(null); setSuccess(null);
    try {
      const { data: requests, error: reqError } = await supabase
        .from('circle_requests')
        .select('id, request_lines(id, article_id)')
        .eq('period_id', periodeId)
        .neq('status', 'draft');
      if (reqError) throw reqError;
      for (const req of requests || []) {
        for (const line of req.request_lines || []) {
          const info = infos[line.article_id];
          if (!info) continue;
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
      const allTotal = articles.every(a => infos[a.id]?.status === 'total');
      await supabase
        .from('order_periods')
        .update({ status: allTotal ? 'closed' : 'ordered' })
        .eq('id', periodeId);
      setSuccess(allTotal ? 'Tous les articles reçus, la période est clôturée.' : 'Réception enregistrée.');
      setTimeout(() => navigate(-1), 1500);
    } catch {
      setError('Erreur lors de la validation de la réception');
    }
    setLoading(false);
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>Réception de la commande</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
      ) : articles.length === 0 ? (
        <Typography>Aucun article à réceptionner pour cette période.</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Référence</TableCell>
                <TableCell>Libellé</TableCell>
                <TableCell>Quantité commandée</TableCell>
                <TableCell>Statut réception</TableCell>
                <TableCell>Quantité reçue</TableCell>
                <TableCell>Commentaire</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {articles.map(art => (
                <TableRow key={art.id}>
                  <TableCell>{art.ref}</TableCell>
                  <TableCell>{art.libelle}</TableCell>
                  <TableCell>{art.quantite}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={infos[art.id]?.status || 'total'}
                      onChange={e => setInfos(info => ({
                        ...info,
                        [art.id]: {
                          ...info[art.id],
                          status: e.target.value as 'total' | 'partial' | 'none',
                          qty: e.target.value === 'total' ? art.quantite : (e.target.value === 'none' ? 0 : info[art.id]?.qty || 0)
                        }
                      }))}
                    >
                      <MenuItem value="total">Reçu en totalité</MenuItem>
                      <MenuItem value="partial">Reçu partiellement</MenuItem>
                      <MenuItem value="none">Non reçu</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {infos[art.id]?.status === 'partial' ? (
                      <TextField
                        type="number"
                        size="small"
                        value={infos[art.id]?.qty || 0}
                        onChange={e => setInfos(info => ({
                          ...info,
                          [art.id]: { ...info[art.id], qty: Math.max(0, Math.min(Number(e.target.value), art.quantite)) }
                        }))}
                        inputProps={{ min: 0, max: art.quantite, style: { width: 60 } }}
                      />
                    ) : (
                      infos[art.id]?.status === 'total' ? art.quantite : 0
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={infos[art.id]?.comment || ''}
                      onChange={e => setInfos(info => ({
                        ...info,
                        [art.id]: { ...info[art.id], comment: e.target.value }
                      }))}
                      placeholder="Commentaire (facultatif)"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={() => navigate(-1)}>Annuler</Button>
        <Button variant="contained" color="primary" onClick={validerReception} disabled={loading}>
          Valider la réception
        </Button>
      </Box>
    </Box>
  );
}