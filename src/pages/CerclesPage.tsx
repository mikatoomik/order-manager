import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Tabs, Tab, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, TextField } from '@mui/material';
import type { User } from '@supabase/supabase-js';
import { periodStatusToLabel } from '../utils/periodUtils';

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
  period: { id: string; nom: string; status: string };
}

interface RequestLine {
  id: string;
  qty: number; // quantité demandée
  qty_validated?: number; // quantité validée par FinAdmin (optionnel)
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

  // Refactor pour pouvoir rafraîchir sans reload ni perte d'onglet
  const fetchCirclesAndRequests = useCallback(async () => {
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
        .select('id, status, created_by, period:period_id (id, nom, status)')
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
          .select('id, qty, qty_validated, article_id, articles:article_id (id, libelle, ref, fournisseur, prix_unitaire)')
          .eq('request_id', req.id);
        const lines = (linesData || []).map((ld: unknown) => {
          const articlesField: unknown = (ld as { articles?: unknown }).articles;
          let articlesObj;
          if (Array.isArray(articlesField)) {
            articlesObj = articlesField[0];
          } else {
            articlesObj = articlesField;
          }
          return {
            id: (ld as { id?: string }).id ?? '',
            qty: (ld as { qty?: number }).qty ?? 0,
            qty_validated: (ld as { qty_validated?: number }).qty_validated,
            article_id: (ld as { article_id?: string }).article_id ?? '',
            articles: articlesObj as RequestLine['articles']
          };
        });
        reqs.push({
          id: req.id,
          status: req.status,
          created_by: req.created_by,
          user_nickname: userProfile?.nickname || req.created_by,
          period: period || { id: '', nom: '-', status: '' },
          lines
        });
      }
      requests[circle.id] = reqs;
    }
    setRequestsByCircle(requests);
  }, [user.id]);

  useEffect(() => {
    fetchCirclesAndRequests();
  }, [user.id, fetchCirclesAndRequests]);

  // Rafraîchissement automatique toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCirclesAndRequests();
    }, 10000); // 10 secondes
    return () => clearInterval(interval);
  }, [fetchCirclesAndRequests]);

  // Met à jour le statut des requests si la période est passée en 'ordered' ou 'closed'
  useEffect(() => {
    // Pour chaque cercle, pour chaque request, si la période est 'ordered' et la request est 'submitted', passer à 'validated'
    // Si la période est 'ordered' ou 'closed' et toutes les lignes ont qty_validated === 0, passer la request à 'closed'
    Object.values(requestsByCircle).forEach(requests => {
      requests.forEach(async req => {
        if (req.period?.status === 'ordered' && req.status === 'submitted') {
          await supabase
            .from('circle_requests')
            .update({ status: 'validated' })
            .eq('id', req.id);
        }
        if ((req.period?.status === 'ordered' || req.period?.status === 'closed') && req.lines.length > 0) {
          const allZero = req.lines.every(l => (typeof l.qty_validated === 'number' ? l.qty_validated : l.qty) === 0);
          if (allZero && req.status !== 'closed') {
            await supabase
              .from('circle_requests')
              .update({ status: 'closed' })
              .eq('id', req.id);
          }
        }
      });
    });
  }, [requestsByCircle]);

  // Traduction des statuts
  const statusToLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'En attente';
      case 'submitted': return 'Envoyée';
      case 'validated': return 'Commandée';
      case 'closed': return 'Reçue';
      case 'waiting': return 'En attente';
      case 'canceled': return 'Annulée';
      default: return status;
    }
  };

  // Ajoute une fonction pour changer le statut d'une request
  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    await supabase
      .from('circle_requests')
      .update({ status: newStatus })
      .eq('id', requestId);
    // Rafraîchir les données sans changer d'onglet
    fetchCirclesAndRequests();
  };

  // Ajoute une fonction pour changer le statut de toutes les requests d'une période pour ce cercle
  const updateAllRequestsStatusForPeriod = async (circleId: string, periodId: string, newStatus: string) => {
    await supabase
      .from('circle_requests')
      .update({ status: newStatus })
      .eq('circle_id', circleId)
      .eq('period_id', periodId)
      .in('status', ['draft', 'submitted']); // Ne modifie que les statuts modifiables
    fetchCirclesAndRequests();
  };

    const updateOrDeleteLine = async (lineId: string, newQty: number) => {
      if (newQty === 0) {
        const ok = window.confirm(
          "Mettre la quantité à 0 supprimera cette ligne. Continuer ?"
        );
        if (!ok) return;
        await supabase.from("request_lines").delete().eq("id", lineId);
      } else {
        await supabase.from("request_lines").update({ qty: newQty }).eq("id", lineId);
      }
      fetchCirclesAndRequests();               // rafraîchir une fois
    };
    const patchLineInState = (
      circleId: string,
      requestId: string,
      lineId: string,
      newQty: number | null      //  null  ⇒ on retire la ligne
    ) =>
      setRequestsByCircle(prev => {
        const clone = { ...prev };
        clone[circleId] = clone[circleId].flatMap(r => {
          if (r.id !== requestId) return r;

          const newLines = newQty === null
            ? r.lines.filter(l => l.id !== lineId)
            : r.lines.map(l => (l.id === lineId ? { ...l, qty: newQty } : l));

          // si plus aucune ligne ⇒ on retire la request
          if (newLines.length === 0) return [];
          return { ...r, lines: newLines };
        });
        return clone;
      });


  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Cercles</Typography>
      {allCircles.length === 0 ? (
        <Typography>Aucun cercle trouvé.</Typography>
      ) : (
        <>
          <Tabs
            value={selectedTab}
            onChange={(_e, v) => setSelectedTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Onglets cercles"
          >
            {allCircles.map((circle) => (
              <Tab
                key={circle.id}
                label={<span style={{ fontWeight: userCircles.includes(circle.id) ? 'bold' : 'normal' }}>{circle.nom}</span>}
                aria-controls={`tabpanel-${circle.id}`}
                id={`tab-${circle.id}`}
              />
            ))}
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {allCircles.map((circle, idx) => (
              <div
                key={circle.id}
                role="tabpanel"
                hidden={selectedTab !== idx}
                id={`tabpanel-${circle.id}`}
                aria-labelledby={`tab-${circle.id}`}
              >
                {selectedTab === idx && (
                  <>
                    {/* 1. Total général du cercle */}
                    {(requestsByCircle[circle.id] || []).length > 0 && (() => {
                      type Statut = 'draft' | 'submitted' | 'validated' | 'closed' | 'waiting' | 'canceled';
                      const totals: Record<Statut, number> = { draft: 0, submitted: 0, validated: 0, closed: 0, canceled: 0, waiting: 0 };
                      (requestsByCircle[circle.id] || []).forEach(req => {
                        const total = req.lines.reduce((sum, l) => sum + (l.articles?.prix_unitaire || 0) * (typeof l.qty_validated === 'number' ? l.qty_validated : l.qty), 0);
                        if (["draft", "submitted", "validated", "closed"].includes(req.status)) {
                          totals[req.status as Statut] += total;
                        }
                      });
                      return (
                        <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600, mb: 3 }}>
                          Total {circle.nom} :
                          <span style={{ color: '#1976d2', marginLeft: 8 }}>commandées {totals.validated.toFixed(2)} €</span>
                          <span style={{ color: '#43a047', marginLeft: 8 }}>reçues {totals.closed.toFixed(2)} €</span>
                          <span style={{ color: '#ff9800', marginLeft: 8 }}>en attente {totals.waiting.toFixed(2)} €</span>
                          <span style={{ color: '#888', marginLeft: 8 }}>annulées {totals.canceled.toFixed(2)} €</span>
                        </Typography>
                      );
                    })()}

                    {/* 2. Liste des requêtes groupées par période */}
                    {(() => {
                      // Grouper les requests par période
                      const requests = requestsByCircle[circle.id] || [];
                      const periods: Record<string, { nom: string; status: string; date_limite?: string; requests: typeof requests }> = {};
                      requests.forEach(req => {
                        const pId = req.period?.id || '-';
                        // On tente de récupérer date_limite si elle existe sur req.period
                        let date_limite: string | undefined = undefined;
                        if (req.period && typeof (req.period as Record<string, unknown>).date_limite === 'string') {
                          date_limite = (req.period as Record<string, string>).date_limite;
                        }
                        if (!periods[pId]) {
                          periods[pId] = {
                            nom: req.period?.nom || '-',
                            status: req.period?.status || '-',
                            date_limite,
                            requests: []
                          };
                        }
                        periods[pId].requests.push(req);
                      });
                      // Tri décroissant par date_limite
                      const sortedPeriods = Object.entries(periods).sort((a, b) => {
                        const dateA = a[1].date_limite ? new Date(a[1].date_limite).getTime() : 0;
                        const dateB = b[1].date_limite ? new Date(b[1].date_limite).getTime() : 0;
                        return dateB - dateA;
                      });
                      return sortedPeriods.map(([pid, p]) => (
                        <Box key={pid} sx={{ mb: 4 }}>
                          {/* Sous-titre période */}
                          <Typography variant="h6" sx={{ mb: 1 }}>{p.nom} <span style={{ color: '#555', fontSize: 15, fontStyle: 'italic' }}>({periodStatusToLabel(p.status)})</span></Typography>
                          {/* Boutons de statut pour la période si ouverte */}
                          {p.status === 'open' && (
                            <Box sx={{ mb: 2 }}>
                              <button
                                style={{ backgroundColor: '#43a047', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
                                onClick={() => updateAllRequestsStatusForPeriod(
                                  circle.id,
                                  pid,
                                  'submitted'
                                )}
                              >Valider toutes les demandes en attente</button>
                              <button
                                style={{ marginLeft: 8 }}
                                onClick={() => updateAllRequestsStatusForPeriod(
                                  circle.id,
                                  pid,
                                  'draft'
                                )}
                              >Remettre toutes en brouillon</button>
                            </Box>
                          )}
                          {/* Tableau des requests de la période */}
                          <TableContainer component={Paper} sx={{ mt: 1, width: '100%', maxWidth: '1800px', overflowX: 'auto' }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  {/* <TableCell sx={{ minWidth: 100, maxWidth: 140 }}>Période</TableCell> */}
                                  <TableCell sx={{ minWidth: 70, maxWidth: 100 }}>Statut</TableCell>
                                  <TableCell sx={{ minWidth: 100, maxWidth: 140 }}>Utilisateur</TableCell>
                                  <TableCell sx={{ minWidth: 200, maxWidth: 400 }}>Détail</TableCell>
                                  <TableCell sx={{ minWidth: 100, maxWidth: 140 }}>Action</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {p.requests.map(req => (
                                  <TableRow key={req.id}>
                                    {/* <TableCell>{req.period?.nom || '-'}<span style={{ color: '#555', marginLeft: 6, fontSize: 12 }}>({periodStatusToLabel(req.period?.status)})</span></TableCell> */}
                                    <TableCell>
                                      <Chip 
                                        label={statusToLabel(req.status)} 
                                        sx={{
                                          backgroundColor: req.status === 'draft' ? '#e0e0e0' // gris
                                            : req.status === 'submitted' ? '#43a047' // vert
                                            : req.status === 'validated' ? '#1976d2' // bleu
                                            : req.status === 'closed' ? '#ff9800' // orange
                                            : undefined,
                                          color: req.status === 'draft' ? '#333'
                                            : req.status === 'submitted' ? 'white'
                                            : req.status === 'validated' ? 'white'
                                            : req.status === 'closed' ? 'white'
                                            : undefined,
                                          fontWeight: 500
                                        }}
                                      />
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
                                                <TableCell>
                                                  {req.status === "draft" ? (
                                                    <TextField
                                                      type="number"
                                                      size="small"
                                                      defaultValue={line.qty}          // ← champ non « contrôlé »
                                                      inputProps={{ min: 0, style: { width: 70 } }}
                                                      onChange={e => {
                                                        const v = Math.max(0, Number(e.target.value));
                                                        patchLineInState(circle.id, req.id, line.id, v);   // ← met à jour l’état local
                                                      }}
                                                      onBlur={(e) => {
                                                        const v = Math.max(0, Number(e.target.value));
                                                        if (v !== line.qty) {
                                                          updateOrDeleteLine(line.id, v);   // on ne rafraîchit qu’après coup
                                                        }
                                                      }}
                                                    />
                                                  ) : (
                                                    <>
                                                      {line.qty}
                                                      {typeof line.qty_validated === "number" && line.qty_validated !== line.qty && (
                                                        <span style={{ color: "#1976d2", marginLeft: 6 }}>→ {line.qty_validated}</span>
                                                      )}
                                                    </>
                                                  )}
                                                </TableCell>
                                                <TableCell>{line.articles?.prix_unitaire ? (line.articles.prix_unitaire * (typeof line.qty_validated === 'number' ? line.qty_validated : line.qty)).toFixed(2) : '-'}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      )}
                                    </TableCell>
                                    {/* Action individuelle si période ouverte et utilisateur concerné, et statut modifiable */}
                                    <TableCell>
                                      {p.status === 'open' && req.created_by === user.id && (
                                        req.status === 'draft' ? (
                                          <button style={{ backgroundColor: '#43a047', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }} onClick={() => updateRequestStatus(req.id, 'submitted')}>Valider</button>
                                        ) : req.status === 'submitted' ? (
                                          <button style={{ backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }} onClick={() => updateRequestStatus(req.id, 'draft')}>Remettre en brouillon</button>
                                        ) : null
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                          {/* Sous-total de la période */}
                          {p.requests.length > 0 && (() => {
                            type Statut = 'draft' | 'submitted' | 'validated' | 'closed' | 'waiting' | 'canceled';
                            const periodTotals: Record<Statut, number> = { draft: 0, submitted: 0, validated: 0, closed: 0, canceled: 0, waiting: 0 };
                            p.requests.forEach(req => {
                              const total = req.lines.reduce((sum, l) => sum + (l.articles?.prix_unitaire || 0) * (typeof l.qty_validated === 'number' ? l.qty_validated : l.qty), 0);
                              if (["draft", "submitted", "validated", "closed", "cancelled", "waiting"].includes(req.status)) {
                                periodTotals[req.status as Statut] += total;
                              }
                            });
                            return (
                              <Typography variant="subtitle2" sx={{ mt: 1, mb: 2 }}>
                                Sous-total :
                                <span style={{ color: '#888', marginLeft: 8 }}>brouillon {periodTotals.draft.toFixed(2)} €</span>
                                <span style={{ color: '#43a047', marginLeft: 8 }}>envoyé {periodTotals.submitted.toFixed(2)} €</span>
                                <span style={{ color: '#1976d2', marginLeft: 8 }}>commandées {periodTotals.validated.toFixed(2)} €</span>
                                <span style={{ color: '#43a047', marginLeft: 8 }}>reçues {periodTotals.closed.toFixed(2)} €</span>
                                <span style={{ color: '#ff9800', marginLeft: 8 }}>en attente {periodTotals.waiting.toFixed(2)} €</span>
                                <span style={{ color: '#888', marginLeft: 8 }}>annulées {periodTotals.canceled.toFixed(2)} €</span>
                              </Typography>
                            );
                          })()}
                        </Box>
                      ));
                    })()}
                  </>
                )}
              </div>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
