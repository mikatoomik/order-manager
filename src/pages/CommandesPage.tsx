import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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

export default function CommandesPage({ user }: CommandesPageProps) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [circleOrders, setCircleOrders] = useState<CircleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Récupérer toutes les périodes
  useEffect(() => {
    async function fetchPeriods() {
      const { data, error } = await supabase
        .from('order_periods')
        .select('*')
        .order('date_limite', { ascending: false });
      
      if (error) {
        console.error('Erreur lors de la récupération des périodes:', error);
        return;
      }
      
      setPeriods(data || []);
      if (data && data.length > 0) {
        setSelectedPeriod(data[0].id);
      }
    }
    fetchPeriods();
  }, []);
  
  // Récupérer les commandes pour la période sélectionnée
  useEffect(() => {
    async function fetchOrdersForPeriod() {
      if (!selectedPeriod) return;
      
      setLoading(true);
      
      try {
        // Récupérer toutes les commandes pour cette période
        const { data: requests, error: requestsError } = await supabase
          .from('circle_requests')
          .select(`
            id,
            circle_id,
            circles:circle_id (id, nom)
          `)
          .eq('period_id', selectedPeriod);
        
        if (requestsError) throw requestsError;
        
        if (!requests || requests.length === 0) {
          setCircleOrders([]);
          setLoading(false);
          return;
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
        
        setCircleOrders(Object.values(ordersByCircle));
      } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrdersForPeriod();
  }, [selectedPeriod]);
  
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Commandes par période
      </Typography>
      
      <FormControl fullWidth margin="normal">
        <InputLabel id="period-select-label">Période</InputLabel>
        <Select
          labelId="period-select-label"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          label="Période"
        >
          {periods.map(period => (
            <MenuItem key={period.id} value={period.id}>
              {period.nom} ({period.status})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : circleOrders.length === 0 ? (
        <Typography sx={{ mt: 4 }}>Aucune commande pour cette période</Typography>
      ) : (
        <Box sx={{ mt: 3 }}>
          {circleOrders.map(order => (
            <Accordion key={order.circle_id} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{order.circle_nom}</Typography>
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
      )}
    </div>
  );
}