import { useState, useEffect } from 'react';
import {
  Link,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Drawer,
  Box,
  List,
  ListItem,
  ListItemText,
  Badge,
  ButtonGroup,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LinkIcon from '@mui/icons-material/Link';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { CatalogueItem, CartItem } from '../types';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { getOrCreatePeriodRecord, type Period } from '../utils/periodUtils';

interface CataloguePageProps {
  catalogue: CatalogueItem[];
  setCatalogue: (c: CatalogueItem[]) => void;
  articles: CartItem[];
  setArticles: (a: CartItem[]) => void;
  user: User;
}

export default function CataloguePage({ catalogue, setCatalogue, articles, setArticles, user }: CataloguePageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);
  const [userCircles, setUserCircles] = useState<{ id: string; nom: string }[]>([]);
  const [selectedCircle, setSelectedCircle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [articleToEdit, setArticleToEdit] = useState<CatalogueItem | null>(null);
  const [editData, setEditData] = useState<Partial<CatalogueItem>>({});
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCurrentPeriod() {
      const period = await getOrCreatePeriodRecord();
      setCurrentPeriod(period);
    }
    fetchCurrentPeriod();
  }, []);

  useEffect(() => {
    async function fetchUserCircles() {
      if (!user) return;

      const { data, error } = await supabase
        .from('user_circles')
        .select('circles(id, nom)')
        .eq('user_id', user.id);

      if (!error) {
        const circles = (data || [])
          .map((item: { circles: { id: string; nom: string }[] | { id: string; nom: string } }) =>
            Array.isArray(item.circles) ? item.circles[0] : item.circles
          )
          .filter(Boolean);
        setUserCircles(circles);
        if (circles.length === 1) setSelectedCircle(circles[0].id);
      }
    }
    fetchUserCircles();
  }, [user]);

  const fetchCatalogue = async () => {
    const { data } = await supabase
      .from('articles')
      .select('id, libelle, ref, fournisseur, prix_unitaire, url, active')
      .eq('active', true);
    setCatalogue(data || []);
  };

  const handleAddArticle = (article: string) => {
    // Vérifier si l'article existe déjà dans le panier
    const existingArticleIndex = articles.findIndex(a => a.libelle === article);
    
    if (existingArticleIndex !== -1) {
      // Si l'article existe déjà, augmenter sa quantité
      const updatedArticles = [...articles];
      updatedArticles[existingArticleIndex].quantite += 1;
      setArticles(updatedArticles);
    } else {
      // Sinon, ajouter un nouvel article avec quantité 1
      setArticles([...articles, { libelle: article, quantite: 1 }]);
    }
    
    setDrawerOpen(true);
  };
  
  const handleIncreaseQuantity = (article: string) => {
    const updatedArticles = [...articles];
    const index = updatedArticles.findIndex(a => a.libelle === article);
    if (index !== -1) {
      updatedArticles[index].quantite += 1;
      setArticles(updatedArticles);
    }
  };
  
  const handleDecreaseQuantity = (article: string) => {
    const updatedArticles = [...articles];
    const index = updatedArticles.findIndex(a => a.libelle === article);
    if (index !== -1) {
      if (updatedArticles[index].quantite > 1) {
        updatedArticles[index].quantite -= 1;
        setArticles(updatedArticles);
      } else {
        // Si la quantité est 1, supprimer l'article
        handleRemoveArticle(article);
      }
    }
  };
  
  const handleRemoveArticle = (article: string) => {
    const updatedArticles = articles.filter(a => a.libelle !== article);
    setArticles(updatedArticles);
  };

  const handleEditArticle = async (
    article: CatalogueItem,
    updatedData: Partial<CatalogueItem>
  ) => {
    try {
      const { data, error } = await supabase.rpc('update_article', {
        p_article_id: article.id,
        p_libelle: updatedData.libelle || article.libelle,
        p_ref: updatedData.ref || article.ref,
        p_fournisseur: updatedData.fournisseur || article.fournisseur,
        p_prix_unitaire: updatedData.prix_unitaire || article.prix_unitaire,
        p_url: updatedData.url || article.url
      });
      if (error) throw error;
      if (data !== article.id) {
        await fetchCatalogue();
      } else {
        const updatedCatalogue = catalogue.map(item =>
          item.id === article.id ? { ...item, ...updatedData } : item
        );
        setCatalogue(updatedCatalogue);
      }
      setEditSuccess(true);
      setTimeout(() => setEditSuccess(false), 3000);
    } catch (err) {
      console.error("Erreur lors de la modification de l'article:", err);
      setEditError("Une erreur est survenue lors de la modification de l'article");
      setTimeout(() => setEditError(null), 3000);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const { error } = await supabase.rpc('delete_article', {
        p_article_id: articleId
      });
      if (error) throw error;
      const updatedCatalogue = catalogue.filter(item => item.id !== articleId);
      setCatalogue(updatedCatalogue);
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (err) {
      console.error("Erreur lors de la suppression de l'article:", err);
      setDeleteError("Une erreur est survenue lors de la suppression de l'article");
      setTimeout(() => setDeleteError(null), 3000);
    }
  };

  const totalPrice = articles.reduce((sum, a) => {
    const item = catalogue.find(c => c.libelle === a.libelle);
    return sum + (item ? item.prix_unitaire * a.quantite : 0);
  }, 0);

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
        await supabase.from('request_lines').delete().eq('request_id', requestId);
      } else {
        const { data: newRequest, error: insertError } = await supabase
          .from('circle_requests')
          .insert([
            { circle_id: selectedCircle, period_id: currentPeriod.id, created_by: user.id, status: 'draft' }
          ])
          .select()
          .single();
        if (insertError) throw insertError;
        requestId = newRequest.id;
      }

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

  const getArticleIdByLibelle = (libelle: string): string => {
    const article = catalogue.find(a => a.libelle === libelle);
    return article ? article.id : '';
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>Catalogue</h1>
        <IconButton
          color="primary"
          onClick={() => setDrawerOpen(true)}
          aria-label="Voir les articles ajoutés"
        >
          <Badge badgeContent={articles.length} color="secondary">
            <ShoppingCartIcon />
          </Badge>
        </IconButton>
      </Box>
      
      <TableContainer component={Paper}>
        <Table aria-label="tableau du catalogue">
          <TableHead>
            <TableRow>
              <TableCell>Libellé</TableCell>
              <TableCell>Référence</TableCell>
              <TableCell>Fournisseur</TableCell>
              <TableCell>Prix unitaire</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {catalogue.map((item) => (
              <TableRow key={item.libelle}>
                <TableCell>{item.libelle}</TableCell>
                <TableCell>{item.ref}</TableCell>
                <TableCell>{item.fournisseur}</TableCell>
                <TableCell>{item.prix_unitaire} €</TableCell>
                <TableCell>
                  {item.url && (
                    <Link href={item.url} target="_blank" rel="noopener noreferrer">
                      <LinkIcon />
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    aria-label={`Ajouter ${item.libelle}`}
                    onClick={() => handleAddArticle(item.libelle)}
                  >
                    <AddIcon />
                  </IconButton>
                  <IconButton
                    color="primary"
                    aria-label={`Éditer ${item.libelle}`}
                    onClick={() => {
                      setArticleToEdit(item);
                      setEditData(item);
                      setEditModalOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    aria-label={`Supprimer ${item.libelle}`}
                    onClick={() => {
                      setArticleToDelete(item.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {catalogue.length === 0 && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Aucun article dans le catalogue
        </Typography>
      )}

      {/* Drawer pour afficher les articles ajoutés */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box
          sx={{ width: 300 }}
          role="presentation"
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6">Mes demandes</Typography>
            <IconButton onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          {articles.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography>Aucune demande</Typography>
            </Box>
          ) : (
            <>
              <List>
                {articles.map((article) => (
                  <ListItem
                    key={article.libelle}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleRemoveArticle(article.libelle)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText primary={article.libelle} />
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => handleDecreaseQuantity(article.libelle)}
                          aria-label="diminuer la quantité"
                        >
                          <RemoveIcon fontSize="small" />
                        </Button>
                        <Button
                          disabled
                          sx={{
                            minWidth: '40px',
                            color: 'black',
                            fontWeight: 'bold',
                            backgroundColor: '#f0f0f0'
                          }}
                        >
                          {article.quantite}
                        </Button>
                        <Button
                          onClick={() => handleIncreaseQuantity(article.libelle)}
                          aria-label="augmenter la quantité"
                        >
                          <AddIcon fontSize="small" />
                        </Button>
                      </ButtonGroup>
                    </Box>
                  </ListItem>
                ))}
              </List>
              <Box sx={{ p: 2, borderTop: '1px solid #eee' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }} data-testid="drawer-total">
                  Total : {totalPrice.toFixed(2)} €
                </Typography>
                {currentPeriod && (
                  <Typography variant="body2" gutterBottom>
                    Période : {currentPeriod.nom}
                  </Typography>
                )}
                {userCircles.length > 1 ? (
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="drawer-circle-label">Cercle</InputLabel>
                    <Select
                      labelId="drawer-circle-label"
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
                ) : (
                  userCircles.length === 1 && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Cercle : {userCircles[0].nom}
                    </Typography>
                  )
                )}
                {submitSuccess && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    Votre commande a été validée avec succès !
                  </Alert>
                )}
                {submitError && (
                  <Alert severity="error" sx={{ mt: 1 }}>
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
            </>
          )}
        </Box>
      </Drawer>

      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <DialogTitle>Modifier l'article</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Libellé"
            value={editData.libelle || ''}
            onChange={e => setEditData({ ...editData, libelle: e.target.value })}
          />
          <TextField
            label="Référence"
            value={editData.ref || ''}
            onChange={e => setEditData({ ...editData, ref: e.target.value })}
          />
          <TextField
            label="Fournisseur"
            value={editData.fournisseur || ''}
            onChange={e => setEditData({ ...editData, fournisseur: e.target.value })}
          />
          <TextField
            label="Prix unitaire"
            type="number"
            value={editData.prix_unitaire ?? ''}
            onChange={e => setEditData({ ...editData, prix_unitaire: Number(e.target.value) })}
          />
          <TextField
            label="URL"
            value={editData.url || ''}
            onChange={e => setEditData({ ...editData, url: e.target.value })}
          />
          {editSuccess && <Alert severity="success">Article modifié</Alert>}
          {editError && <Alert severity="error">{editError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditModalOpen(false)}>Annuler</Button>
          <Button
            onClick={async () => {
              if (articleToEdit) {
                await handleEditArticle(articleToEdit, editData);
                setEditModalOpen(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Supprimer l'article ?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button
            color="error"
            onClick={async () => {
              if (articleToDelete) {
                await handleDeleteArticle(articleToDelete);
                setDeleteDialogOpen(false);
              }
            }}
          >
            Supprimer
          </Button>
        </DialogActions>
        <Box sx={{ p: 2 }}>
          {deleteSuccess && <Alert severity="success">Article supprimé</Alert>}
          {deleteError && <Alert severity="error">{deleteError}</Alert>}
        </Box>
      </Dialog>
    </div>
  )
}
