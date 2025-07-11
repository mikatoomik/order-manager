import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { supabase } from '../supabaseClient';
import { getCurrentPeriodRecord } from '../utils/periodUtils';
import { useNavigate } from 'react-router-dom';

// Interfaces pour les données retournées par Supabase

interface Period {
  id: string;
  nom: string;
  date_limite: string;
  status: string;
}

interface CircleOrder {
  circle_id: string;
  circle_nom: string;
  articles: {
    article_id: string;
    libelle: string;
    ref: string;
    fournisseur: string;
    prix_unitaire: number;
    total_qty: number;
    delivery_date?: string | null; // Ajout de la date de livraison
  }[];
}

interface PeriodOrders {
  period: Period;
  circleOrders: CircleOrder[];
  total: number;
  status: Period['status'];
}

interface CommandesPageProps {
  onReceptionRequest?: (periodId: string) => void;
}

export default function CommandesPage({ onReceptionRequest }: CommandesPageProps) {
  const [periodOrders, setPeriodOrders] = useState<PeriodOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPeriodsAndOrders() {
      setLoading(true);
      const { data: periodsData, error } = await supabase
        .from('order_periods')
        .select('*')
        .order('date_limite', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des périodes:', error);
        setLoading(false);
        return;
      }

      const results: PeriodOrders[] = [];
      if (periodsData) {
        for (const period of periodsData) {
          const { circleOrders, total } = await fetchOrdersForPeriod(period.id);
          results.push({ period, circleOrders, total, status: period.status });
        }
      }

      setPeriodOrders(results);
      setLoading(false);
    }

    fetchPeriodsAndOrders();
  }, []);

  useEffect(() => {
    (async () => {
      await getCurrentPeriodRecord();
      // Recharger les périodes et commandes après la création éventuelle de la période
      const { data: periodsData, error } = await supabase
        .from('order_periods')
        .select('*')
        .order('date_limite', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des périodes:', error);
        return;
      }

      const results: PeriodOrders[] = [];
      if (periodsData) {
        for (const period of periodsData) {
          const { circleOrders, total } = await fetchOrdersForPeriod(period.id);
          results.push({ period, circleOrders, total, status: period.status });
        }
      }

      setPeriodOrders(results);
    })();
  }, []);

  async function fetchOrdersForPeriod(periodId: string): Promise<{ circleOrders: CircleOrder[]; total: number }> {
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('circle_requests')
        .select(
          `id,
           circle_id,
           circles:circle_id (id, nom),
           status`
        )
        .eq('period_id', periodId);
      
      if (requestsError) throw requestsError;

      // Filtrer pour ne garder que les statuts différents de 'draft'
      const filteredRequests = (requests || []).filter(r => r.status !== 'draft');
      if (filteredRequests.length === 0) {
        return { circleOrders: [], total: 0 };
      }
      
      // Créer un tableau pour stocker les commandes par cercle
      const ordersByCircle: Record<string, CircleOrder> = {};
      
      // Pour chaque commande, récupérer les lignes et les articles
      for (const request of filteredRequests) {
        const circleId = request.circle_id;
        // Gestion du typage : request.circles peut être un tableau ou un objet
        const circle = Array.isArray(request.circles) ? request.circles[0] : request.circles;
        const circleName = circle.nom;
        if (!ordersByCircle[circleId]) {
          ordersByCircle[circleId] = {
            circle_id: circleId,
            circle_nom: circleName,
            articles: []
          };
        }
        // Récupérer les lignes de commande pour cette commande
        const { data: requestLines, error: linesError } = await supabase
          .from('request_lines')
          .select(`
            id,
            qty,
            qty_validated,
            article_id,
            delivery_date,
            articles:article_id (id, libelle, ref, fournisseur, prix_unitaire)
          `)
          .eq('request_id', request.id);
        if (linesError) throw linesError;
        // Utiliser qty_validated si elle existe pour l'agrégation
        if (requestLines && requestLines.length > 0) {
          requestLines.forEach(line => {
            const article = Array.isArray(line.articles) ? line.articles[0] : line.articles;
            const qtyToUse = typeof line.qty_validated === 'number' ? line.qty_validated : line.qty;
            const existingArticleIndex = ordersByCircle[circleId].articles.findIndex(a => a.article_id === line.article_id && a.delivery_date === line.delivery_date);
            if (existingArticleIndex !== -1) {
              // Si l'article existe déjà (même id et même date de livraison), augmenter la quantité
              ordersByCircle[circleId].articles[existingArticleIndex].total_qty += qtyToUse;
            } else {
              // Sinon, ajouter un nouvel article
              ordersByCircle[circleId].articles.push({
                article_id: line.article_id,
                libelle: article.libelle,
                ref: article.ref,
                fournisseur: article.fournisseur,
                prix_unitaire: article.prix_unitaire,
                total_qty: qtyToUse,
                delivery_date: line.delivery_date || null
              });
            }
          });
        }
      }
      
      const circleOrdersArray = Object.values(ordersByCircle);
      const periodTotal = circleOrdersArray.reduce(
        (sum, o) =>
          sum +
          o.articles.reduce(
            (s, a) => s + a.prix_unitaire * a.total_qty,
            0
          ),
        0
      );

      return { circleOrders: circleOrdersArray, total: periodTotal };
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes:', error);
      return { circleOrders: [], total: 0 };
    }
  }
  
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Commandes par période
      </Typography>
      
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : periodOrders.length === 0 ? (
        <Typography sx={{ mt: 4 }}>Aucune commande</Typography>
      ) : (
        <Box sx={{ mt: 3 }}>
          {periodOrders
            .filter(po => po.period.status !== 'archived')
            .sort((a, b) => new Date(b.period.date_limite).getTime() - new Date(a.period.date_limite).getTime())
            .map(po => (
              <Box
                key={po.period.id}
                sx={{
                  mb: 4,
                  p: 2,
                  borderRadius: 1,
                  backgroundColor:
                    po.period.status === 'open'
                      ? '#e8f5e9'
                      : po.period.status === 'ordered' || po.period.status === 'waiting'
                        ? '#e3f2fd' // bleu clair
                        : '#eeeeee'
                }}
              >
                <Typography variant="h5" sx={{ mb: 2 }} data-testid="period-total">
                  {po.period.nom} - {po.total.toFixed(2)} € - {getStatusLabel(po.period.status)}
                </Typography>
                {(po.period.status === 'ordered' || po.period.status === 'waiting') && (
                  <Button variant="contained" color="primary" sx={{ mb: 2 }} onClick={() => onReceptionRequest ? onReceptionRequest(po.period.id) : navigate(`/reception/${po.period.id}`)}>
                    Réceptionner la commande
                  </Button>
                )}
                {po.circleOrders.map(order => (
                  <Accordion key={order.circle_id} sx={{ mb: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" data-testid="circle-total">
                        {order.circle_nom} -{' '}
                        {order.articles
                          .reduce((sum, art) => sum + art.prix_unitaire * art.total_qty, 0)
                          .toFixed(2)}{' '}
                        €
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Référence</TableCell>
                              <TableCell>Libellé</TableCell>
                              <TableCell>Fournisseur</TableCell>
                              <TableCell>Prix unitaire</TableCell>
                              <TableCell>Quantité</TableCell>
                              <TableCell>Total</TableCell>
                              {po.period.status === 'ordered' && (
                                <TableCell>Date livraison estimée</TableCell>
                              )}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {order.articles.map(article => (
                              <TableRow key={article.article_id + (article.delivery_date || '')}>
                                <TableCell>{article.ref}</TableCell>
                                <TableCell>{article.libelle}</TableCell>
                                <TableCell>{article.fournisseur}</TableCell>
                                <TableCell>{article.prix_unitaire} €</TableCell>
                                <TableCell>{article.total_qty}</TableCell>
                                <TableCell>{(article.prix_unitaire * article.total_qty).toFixed(2)} €</TableCell>
                                {po.period.status === 'ordered' && (
                                  <TableCell>{article.delivery_date ? new Date(article.delivery_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ textAlign: 'right', mt: 1 }} data-testid="circle-total">
                <Typography variant="subtitle2">
                  Total commande :
                  {' '}
                  {order.articles
                    .reduce(
                      (sum, art) => sum + art.prix_unitaire * art.total_qty,
                      0
                    )
                    .toFixed(2)}{' '}
                  €
                </Typography>
              </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            ))}
        </Box>
      )}
    </div>
  );
}

// Ajout de la fonction utilitaire pour la traduction du statut
function getStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Ouverte';
    case 'ordered':
      return 'Commandée';
    case 'archived':
      return 'Archivée';
    case 'closed':
      return 'Fermée';
    case 'waiting':
      return 'En attente';
    default:
      return status;
  }
}