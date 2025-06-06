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
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';

interface CommandesPageProps {
  user: User;
}

// Interfaces pour les données retournées par Supabase
interface Circle {
  id: string;
  nom: string;
}

interface Article {
  id: string;
  libelle: string;
  ref: string;
  fournisseur: string;
  prix_unitaire: number;
}

interface RequestLine {
  id: string;
  qty: number;
  article_id: string;
  articles: Article;
}

interface CircleRequest {
  id: string;
  circle_id: string;
  circles: Circle;
}

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
  }[];
}

interface PeriodOrders {
  period: Period;
  circleOrders: CircleOrder[];
  total: number;
}

export default function CommandesPage({ user }: CommandesPageProps) {
  const [periodOrders, setPeriodOrders] = useState<PeriodOrders[]>([]);
  const [loading, setLoading] = useState(true);

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
          results.push({ period, circleOrders, total });
        }
      }

      setPeriodOrders(results);
      setLoading(false);
    }

    fetchPeriodsAndOrders();
  }, []);

  async function fetchOrdersForPeriod(periodId: string): Promise<{ circleOrders: CircleOrder[]; total: number }> {
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('circle_requests')
        .select(
          `id,
           circle_id,
           circles:circle_id (id, nom)`
        )
        .eq('period_id', periodId);
        
        if (requestsError) throw requestsError;

        if (!requests || requests.length === 0) {
          return { circleOrders: [], total: 0 };
        }
        
        // Créer un tableau pour stocker les commandes par cercle
        const ordersByCircle: Record<string, CircleOrder> = {};
        
        // Pour chaque commande, récupérer les lignes et les articles
        for (const request of requests) {
          const circleId = request.circle_id;
          // Utiliser une assertion de type pour accéder aux propriétés
          const circle = request.circles as any;
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
              article_id,
              articles:article_id (id, libelle, ref, fournisseur, prix_unitaire)
            `)
            .eq('request_id', request.id);
          
          if (linesError) throw linesError;
          
          if (requestLines && requestLines.length > 0) {
            // Pour chaque ligne, ajouter ou mettre à jour l'article dans la commande du cercle
            requestLines.forEach(line => {
              // Utiliser une assertion de type pour accéder aux propriétés
              const article = line.articles as any;
              const existingArticleIndex = ordersByCircle[circleId].articles.findIndex(a => a.article_id === line.article_id);
              
              if (existingArticleIndex !== -1) {
                // Si l'article existe déjà, augmenter la quantité
                ordersByCircle[circleId].articles[existingArticleIndex].total_qty += line.qty;
              } else {
                // Sinon, ajouter un nouvel article
                ordersByCircle[circleId].articles.push({
                  article_id: line.article_id,
                  libelle: article.libelle,
                  ref: article.ref,
                  fournisseur: article.fournisseur,
                  prix_unitaire: article.prix_unitaire,
                  total_qty: line.qty
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
          {periodOrders.map(po => (
            <Box
              key={po.period.id}
              sx={{
                mb: 4,
                p: 2,
                borderRadius: 1,
                backgroundColor: po.period.status === 'open' ? '#e8f5e9' : '#eeeeee'
              }}
            >
              <Typography variant="h5" sx={{ mb: 2 }} data-testid="period-total">
                {po.period.nom} - {po.total.toFixed(2)} €
              </Typography>
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
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {order.articles.map(article => (
                            <TableRow key={article.article_id}>
                              <TableCell>{article.ref}</TableCell>
                              <TableCell>{article.libelle}</TableCell>
                              <TableCell>{article.fournisseur}</TableCell>
                              <TableCell>{article.prix_unitaire} €</TableCell>
                              <TableCell>{article.total_qty}</TableCell>
                              <TableCell>{(article.prix_unitaire * article.total_qty).toFixed(2)} €</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
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