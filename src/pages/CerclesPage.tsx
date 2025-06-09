import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Tabs, Tab, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserCircle } from '../types';

interface CerclesPageProps {
  user: User;
}

interface Circle {
  id: string;
  nom: string;
}

interface CircleRequest {
  id: string;
  status: string;
  created_by: string;
  user_nickname: string; // Ajouté pour le surnom
  period: { id: string; nom: string; };
}

interface RequestLine {
  id: string;
  qty: number;
  article_id: string;
  articles: {
    id: string;
    libelle: string;
    ref: string;
    fournisseur: string;
    prix_unitaire: number;
  };
}

interface CircleRequestWithLines extends CircleRequest {
  lines: RequestLine[];
}

export default function CerclesPage({ user }: CerclesPageProps) {
  const [allCircles, setAllCircles] = useState<Circle[]>([]);
  const [userCircles, setUserCircles] = useState<string[]>([]); // ids des cercles de l'utilisateur
  const [selectedTab, setSelectedTab] = useState(0);
  const [requestsByCircle, setRequestsByCircle] = useState<Record<string, CircleRequestWithLines[]>>({});

  useEffect(() => {
    async function fetchCirclesAndRequests() {
      // Récupère tous les cercles
      const { data: allCirclesData } = await supabase
        .from('circles')
        .select('id, nom');
      setAllCircles(allCirclesData || []);
      // Récupère les cercles de l'utilisateur
      const { data: userCirclesData } = await supabase
        .from('user_circles')
        .select('circles(id)')
        .eq('user_id', user.id);
      // Correction du typage pour userCirclesData (cas où circles est un tableau)
      setUserCircles(
        ((userCirclesData || [])
          .map((item: { circles: { id: string } | { id: string }[] | null }) => {
            if (!item.circles) return undefined;
            if (Array.isArray(item.circles)) return item.circles[0]?.id;
            return item.circles.id;
          })
          .filter((id): id is string => typeof id === 'string'))
      );
      // Pour chaque cercle, récupère les commandes (circle_requests)
      const requests: Record<string, CircleRequestWithLines[]> = {};
      for (const circle of allCirclesData || []) {
        const { data: crData } = await supabase
          .from('circle_requests')
          .select('id, status, created_by, period:period_id (id, nom)')
          .eq('circle_id', circle.id);
        const reqs: CircleRequestWithLines[] = [];
        for (const req of crData || []) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('nickname')
            .eq('user_id', req.created_by)
            .single();
          const period = Array.isArray(req.period) ? req.period[0] : req.period;
          // Récupérer les lignes de commande (request_lines)
          const { data: linesData } = await supabase
            .from('request_lines')
            .select('id, qty, article_id, articles:article_id (id, libelle, ref, fournisseur, prix_unitaire)')
            .eq('request_id', req.id);
          // Correction : articles peut être un tableau (cas Supabase)
          const lines = (linesData || []).map((line: {
            id: string;
            qty: number;
            article_id: string;
            articles: { id: string; libelle: string; ref: string; fournisseur: string; prix_unitaire: number } | { id: string; libelle: string; ref: string; fournisseur: string; prix_unitaire: number }[];
          }) => ({
            ...line,
            articles: Array.isArray(line.articles) ? line.articles[0] : line.articles
          }));
          reqs.push({
            id: req.id,
            status: req.status,
            created_by: req.created_by,
            user_nickname: userProfile?.nickname || req.created_by,
            period: period || { id: '', nom: '-' },
            lines
          });
        }
        requests[circle.id] = reqs;
      }
      setRequestsByCircle(requests);
    }
    fetchCirclesAndRequests();
  }, [user.id]);

  // Traduction des statuts
  const statusToLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'En attente';
      case 'submitted': return 'Envoyée';
      case 'validated': return 'Commandée';
      case 'closed': return 'Annulée';
      default: return status;
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Cercles</Typography>
      {allCircles.length === 0 ? (
        <Typography>Aucun cercle trouvé.</Typography>
      ) : (
        <>
          <Tabs value={selectedTab} onChange={(_e, v) => setSelectedTab(v)}>
            {allCircles.map((circle) => (
              <Tab key={circle.id} label={<span style={{ fontWeight: userCircles.includes(circle.id) ? 'bold' : 'normal' }}>{circle.nom}</span>} />
            ))}
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {allCircles.map((circle, idx) => (
              <div key={circle.id} hidden={selectedTab !== idx}>
                <Typography variant="h6">Commandes du cercle {circle.nom}</Typography>
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Période</TableCell>
                        <TableCell>Statut</TableCell>
                        <TableCell>Utilisateur</TableCell>
                        <TableCell>Détail</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(requestsByCircle[circle.id] || []).map(req => (
                        <TableRow key={req.id}>
                          <TableCell>{req.period?.nom || '-'}</TableCell>
                          <TableCell>
                            <Chip label={statusToLabel(req.status)} color={req.status === 'open' ? 'success' : req.status === 'ordered' ? 'info' : req.status === 'closed' ? 'warning' : 'default'} />
                          </TableCell>
                          <TableCell>{req.user_nickname}</TableCell>
                          <TableCell>
                            {req.lines.length === 0 ? (
                              <Typography variant="body2">Aucun article</Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Libellé</TableCell>
                                    <TableCell>Réf.</TableCell>
                                    <TableCell>Fournisseur</TableCell>
                                    <TableCell>PU</TableCell>
                                    <TableCell>Qté</TableCell>
                                    <TableCell>Total</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {req.lines.map(line => (
                                    <TableRow key={line.id}>
                                      <TableCell>{line.articles?.libelle || '-'}</TableCell>
                                      <TableCell>{line.articles?.ref || '-'}</TableCell>
                                      <TableCell>{line.articles?.fournisseur || '-'}</TableCell>
                                      <TableCell>{line.articles?.prix_unitaire?.toFixed(2) || '-'}</TableCell>
                                      <TableCell>{line.qty}</TableCell>
                                      <TableCell>{line.articles?.prix_unitaire ? (line.articles.prix_unitaire * line.qty).toFixed(2) : '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
