import { useState, useEffect } from 'react';
import { Button, FormControl, InputLabel, Select, MenuItem, Box, Typography, Alert } from '@mui/material';
import { supabase } from '../supabaseClient';
import { getCurrentPeriodRecord } from '../utils/periodUtils';
import type { Period } from '../utils/periodUtils';
import type { CartItem, CatalogueItem } from '../types';
import type { User } from '@supabase/supabase-js';

interface DemandesPageProps {
  articles: CartItem[];
  setArticles: (a: CartItem[]) => void;
  catalogue: CatalogueItem[];
  user: User;
}

interface UserCircle {
  id: string;
  nom: string;
}

export default function DemandesPage({ articles, setArticles, catalogue, user }: DemandesPageProps) {
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);
  const [userCircles, setUserCircles] = useState<UserCircle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Récupérer la période en cours
  useEffect(() => {
    async function fetchCurrentPeriod() {
      const period = await getCurrentPeriodRecord();
      setCurrentPeriod(period);
    }
    fetchCurrentPeriod();
  }, []);

  // Récupérer les cercles de l'utilisateur
  useEffect(() => {
    async function fetchUserCircles() {
      if (!user) return;
      const { data, error } = await supabase
        .from('user_circles')
        .select('circles(id, nom)')
        .eq('user_id', user.id);
      if (error) {
        console.error('Erreur lors de la récupération des cercles:', error);
        return;
      }
      // Correction : chaque item.circles est un tableau
      const circles: UserCircle[] = (data || [])
        .map((item: { circles: UserCircle[] }) => Array.isArray(item.circles) ? item.circles[0] : item.circles)
        .filter(Boolean);
      setUserCircles(circles);
      if (circles.length === 1) {
        setSelectedCircle(circles[0].id);
      }
    }
    fetchUserCircles();
  }, [user]);

  const handleValidateOrder = async () => {
    if (!currentPeriod) {
      setSubmitError('Impossible de déterminer la période en cours');
      return;
    }
    if (!selectedCircle) {
      setSubmitError('Veuillez sélectionner un cercle');
      return;
    }
    if (articles.length === 0) {
      setSubmitError('Votre panier est vide');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Vérifier si une commande existe déjà pour ce cercle et cette période
      const { data: existingRequest } = await supabase
        .from('circle_requests')
        .select('id')
        .eq('circle_id', selectedCircle)
        .eq('period_id', currentPeriod.id)
        .eq('created_by', user.id)
        .single();
      let requestId;
      if (existingRequest) {
        requestId = existingRequest.id;
        // Supprimer les lignes existantes
        await supabase
          .from('request_lines')
          .delete()
          .eq('request_id', requestId);
      } else {
        // Créer une nouvelle commande
        const { data: newRequest, error: insertError } = await supabase
          .from('circle_requests')
          .insert([
            {
              circle_id: selectedCircle,
              period_id: currentPeriod.id,
              created_by: user.id,
              status: 'draft'
            }
          ])
          .select()
          .single();
        if (insertError) throw insertError;
        requestId = newRequest.id;
      }
      // Insérer les nouvelles lignes de commande
      const requestLines = articles.map(article => ({
        request_id: requestId,
        article_id: getArticleIdByLibelle(article.libelle),
        qty: article.quantite
      }));
      const { error: linesError } = await supabase
        .from('request_lines')
        .insert(requestLines);
      if (linesError) throw linesError;
      setSubmitSuccess(true);
      setArticles([]);
    } catch (error) {
      console.error('Erreur lors de la validation de la commande:', error);
      setSubmitError('Une erreur est survenue lors de la validation de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour obtenir l'ID d'un article à partir de son libellé
  const getArticleIdByLibelle = (libelle: string): string => {
    const article = catalogue.find(a => a.libelle === libelle);
    return article ? article.id : '';
  };

  return (
    <div>
      <h1>Mes demandes</h1>
      {/* ... contenu du panier ... */}
      {articles.length > 0 && (
        <Box sx={{ mt: 4, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Valider ma commande
          </Typography>
          {currentPeriod && (
            <Typography variant="body2" gutterBottom>
              Période de commande : {currentPeriod.nom}
            </Typography>
          )}
          {userCircles.length > 1 && (
            <FormControl fullWidth margin="normal">
              <InputLabel id="circle-select-label">Cercle</InputLabel>
              <Select
                labelId="circle-select-label"
                value={selectedCircle}
                onChange={(e) => setSelectedCircle(e.target.value)}
                label="Cercle"
              >
                {userCircles.map(circle => (
                  <MenuItem key={circle.id} value={circle.id}>
                    {circle.nom}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {submitSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Votre commande a été validée avec succès !
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {submitError}
            </Alert>
          )}
          <Button
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleValidateOrder}
            disabled={isSubmitting || articles.length === 0 || (userCircles.length > 1 && !selectedCircle)}
          >
            {isSubmitting ? 'Validation en cours...' : 'Valider ma commande'}
          </Button>
        </Box>
      )}
    </div>
  );
}
