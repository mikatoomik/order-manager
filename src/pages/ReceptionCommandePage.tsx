import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import dayjs from 'dayjs';

interface ArticleCommande {
  id: string;
  libelle: string;
  ref: string;
  quantite: number;
  delivery_date?: string;
  period_id: string;
  period_nom: string;
}

type ReceptionStatus = 'totaly' | 'partialy' | 'none';

export default function ReceptionCommandePage({ user }: { user: User }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleCommande[]>([]);
  const [infos, setInfos] = useState<Record<string, { status: ReceptionStatus; qty: number; comment: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Record<string, { id: string; nom: string }>>({});

  /* ------------------------------------------------------------------
   * CHARGEMENT DES ARTICLES A RECEPTIONNER
   * ----------------------------------------------------------------*/
  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      setError(null);

      const { data: periodsData, error: periodsErr } = await supabase
        .from('order_periods')
        .select('id, nom')
        .in('status', ['ordered', 'waiting'])
      if (periodsErr) {
        setError('Impossible de charger les périodes');
        setLoading(false);
        return;
      }

      const periodIds = periodsData.map(p => p.id);
      const periodsMap = Object.fromEntries(periodsData.map(p => [p.id, p]));
      setPeriods(periodsMap);
      if (!periodIds.length) {
        setLoading(false);
        return;
      }

      const { data: reqs, error: reqErr } = await supabase
        .from('circle_requests')
        .select(`id, period_id, request_lines(id, qty_validated, qty_received, delivery_date, article_id, articles(id, libelle, ref))`)
        .in('period_id', periodIds)
        .neq('status', 'draft');
      if (reqErr) {
        setError('Erreur lors du chargement des commandes');
        setLoading(false);
        return;
      }

      const articlesMap: Record<string, ArticleCommande> = {};
      for (const req of reqs) {
        for (const line of req.request_lines) {
          const art = Array.isArray(line.articles) ? line.articles[0] : line.articles;
          if (!art) continue;

          // 👉 quantité RESTANTE
          const remaining = (line.qty_validated ?? 0) - (line.qty_received ?? 0);
          if (remaining <= 0) continue;         // déjà tout reçu

          const key = `${art.id}_${line.delivery_date ?? 'no_date'}`;
          if (!articlesMap[key]) {
            articlesMap[key] = {
              id: art.id,
              libelle: art.libelle,
              ref: art.ref,
              quantite: 0,
              delivery_date: line.delivery_date ?? undefined,
              period_id: req.period_id,
              period_nom: periodsMap[req.period_id].nom,
            };
          }
          articlesMap[key].quantite += remaining;   // ⚠️ on additionne « remaining »
        }
      }

      const arts = Object.values(articlesMap).sort((a, b) => {
        if (!a.delivery_date) return 1;
        if (!b.delivery_date) return -1;
        return a.delivery_date!.localeCompare(b.delivery_date!);
      });
      setArticles(arts);
      setInfos(Object.fromEntries(arts.map(a => {
        const key = `${a.id}_${a.delivery_date ?? 'no_date'}`;
        return [key, { status: 'totaly', qty: a.quantite, comment: '' }];
      })));
      setLoading(false);
    }

    fetchArticles();
  }, []);

  /* ------------------------------------------------------------------
   * VALIDATION RECEPTION
   * ----------------------------------------------------------------*/
  async function validerReception() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedRequestIds = new Set<string>();

      for (const art of articles) {
        const key = `${art.id}_${art.delivery_date ?? 'no_date'}`;
        const info = infos[key];
        if (!info) continue;

        let query = supabase
          .from('request_lines')
          .select('id, request_id, qty_validated, circle_requests!inner(period_id)')
          .eq('article_id', art.id)
          .eq('circle_requests.period_id', art.period_id)
          .neq('circle_requests.status', 'draft');
        if (art.delivery_date) query = query.eq('delivery_date', art.delivery_date); else query = query.is('delivery_date', null);

        const { data: lines, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;

       // --- Répartition proportionnelle de la quantité reçue -----------------
        const totalValidated = (lines ?? []).reduce(
          (acc, l) => acc + (l.qty_validated ?? 0),
          0
        );
        if (totalValidated === 0) continue;

        // 1) part « entière » arrondie vers le bas
        const provisional: { id: string; request_id: string; qty: number; remainder: number }[] =
          (lines ?? []).map(l => {
            const exactShare = (info.qty * (l.qty_validated ?? 0)) / totalValidated;
            return {
              id: l.id,
              request_id: l.request_id,
              qty: Math.floor(exactShare),
              remainder: exactShare - Math.floor(exactShare),
            };
          });

        // 2) redistribuer le reste (somme exacte = info.qty)
        let rest = info.qty - provisional.reduce((a, p) => a + p.qty, 0);
        provisional.sort((a, b) => b.remainder - a.remainder); // plus grands décimaux d’abord
        for (const p of provisional) {
          if (rest === 0) break;
          p.qty += 1;
          rest -= 1;
        }

        // 3) mise à jour en base
        for (const p of provisional) {
          await supabase
            .from('request_lines')
            .update({
              reception_status: info.status,
              qty_received: p.qty,
              reception_comment: info.comment,
              reception_date: new Date().toISOString(),
              reception_user: user.id,
            })
            .eq('id', p.id);

          updatedRequestIds.add(p.request_id);
        }
        // ----------------------------------------------------------------------

      }

      // Mise à jour des circle_requests et periods
      const periodSummary: Record<string, { closed: number; waiting: number; total: number }> = {};

      for (const reqId of updatedRequestIds) {
        const { data: reqLines } = await supabase
          .from('request_lines')
          .select('reception_status, circle_requests!inner(period_id)')
          .eq('request_id', reqId);

        const statuses = reqLines!.map(r => r.reception_status);
        const periodId = reqLines![0].circle_requests.period_id;
        const allTotal = statuses.every(s => s === 'totaly');
        const allNone = statuses.every(s => s === 'none');
        const hasPartial = statuses.some(s => s === 'partialy');

        let newReqStatus: string;
        if (allTotal) newReqStatus = 'closed';
        else if (hasPartial) newReqStatus = 'waiting';
        else if (allNone) newReqStatus = 'validated';
        else newReqStatus = 'waiting';

        await supabase.from('circle_requests').update({ status: newReqStatus }).eq('id', reqId);

        if (!periodSummary[periodId]) periodSummary[periodId] = { closed: 0, waiting: 0, total: 0 };
        periodSummary[periodId].total += 1;
        if (newReqStatus === 'closed') periodSummary[periodId].closed += 1;
        if (newReqStatus === 'waiting') periodSummary[periodId].waiting += 1;
      }

      for (const [periodId, stats] of Object.entries(periodSummary)) {
        const newPeriodStatus = stats.closed === stats.total ? 'closed' : stats.waiting > 0 ? 'waiting' : 'ordered';
        await supabase.from('order_periods').update({ status: newPeriodStatus }).eq('id', periodId);
      }

      setSuccess('Réception enregistrée.');
      setTimeout(() => navigate('/commandes'), 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------
   * PREPARATION AFFICHAGE
   * ----------------------------------------------------------------*/
  const articlesByDate: Record<string, ArticleCommande[]> = {};
  articles.forEach(a => {
    const key = a.delivery_date ?? 'Sans date';
    if (!articlesByDate[key]) articlesByDate[key] = [];
    articlesByDate[key].push(a);
  });
  const sortedDates = Object.keys(articlesByDate).sort((a, b) => {
    if (a === 'Sans date') return 1;
    if (b === 'Sans date') return -1;
    return a.localeCompare(b);
  });

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Réception des commandes
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : articles.length === 0 ? (
        <Typography>Aucun article à réceptionner.</Typography>
      ) : (
        <>
          {sortedDates.map(dateKey => (
            <Box key={dateKey} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {dateKey === 'Sans date'
                  ? 'Articles sans date de livraison prévue'
                  : `Livraison prévue le ${dayjs(dateKey).format('DD/MM/YYYY')}`}                
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Réf.</TableCell>
                      <TableCell>Libellé</TableCell>
                      <TableCell>Période</TableCell>
                      <TableCell>Qté commandée</TableCell>
                      <TableCell>Statut réception</TableCell>
                      <TableCell>Qté reçue</TableCell>
                      <TableCell>Commentaire</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {articlesByDate[dateKey].map(art => {
                      const rowKey = `${art.id}_${art.delivery_date ?? 'no_date'}`;
                      const info = infos[rowKey];
                      return (
                        <TableRow key={rowKey}>
                          <TableCell>{art.ref}</TableCell>
                          <TableCell>{art.libelle}</TableCell>
                          <TableCell>{art.period_nom}</TableCell>
                          <TableCell>{art.quantite}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={info.status}
                              onChange={e =>
                                setInfos(prev => ({
                                  ...prev,
                                  [rowKey]: {
                                    ...prev[rowKey],
                                    status: e.target.value as ReceptionStatus,
                                    qty:
                                      e.target.value === 'totaly'
                                        ? art.quantite
                                        : e.target.value === 'none'
                                        ? 0
                                        : prev[rowKey].qty,
                                  },
                                }))
                              }
                            >
                              <MenuItem value="totaly">Reçu en totalité</MenuItem>
                              <MenuItem value="partialy">Reçu partiellement</MenuItem>
                              <MenuItem value="none">Non reçu</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {info.status === 'partialy' ? (
                              <TextField
                                type="number"
                                size="small"
                                value={info.qty}
                                onChange={e =>
                                  setInfos(prev => ({
                                    ...prev,
                                    [rowKey]: {
                                      ...prev[rowKey],
                                      qty: Math.max(
                                        0,
                                        Math.min(Number(e.target.value), art.quantite)
                                      ),
                                    },
                                  }))
                                }
                                inputProps={{ min: 0, max: art.quantite, style: { width: 60 } }}
                              />
                            ) : info.status === 'totaly' ? (
                              art.quantite
                            ) : (
                              0
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={info.comment}
                              onChange={e =>
                                setInfos(prev => ({
                                  ...prev,
                                  [rowKey]: { ...prev[rowKey], comment: e.target.value },
                                }))
                              }
                              placeholder="(facultatif)"
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={validerReception}
              disabled={loading}
            >
              Valider la réception
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
