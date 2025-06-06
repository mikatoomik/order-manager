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
  Alert,
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
  
  // État pour la modale d'ajout d'article
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newArticle, setNewArticle] = useState<Omit<CatalogueItem, 'id'>>({
    libelle: '',
    ref: '',
    fournisseur: '',
    prix_unitaire: 0,
    url: ''
  });
  const [addArticleError, setAddArticleError] = useState<string | null>(null);
  const [addArticleSuccess, setAddArticleSuccess] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);

  // Pagination, tri, recherche, filtre
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<'libelle' | 'ref' | 'fournisseur' | 'prix_unitaire'>('libelle');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [filterFournisseur, setFilterFournisseur] = useState('');

  // Fournisseurs uniques pour le filtre
  const fournisseurs = Array.from(new Set(catalogue.map(a => a.fournisseur).filter(Boolean)));

  // Fonction de tri
  const sortCatalogue = (a: CatalogueItem, b: CatalogueItem) => {
    let v1 = a[sortBy];
    let v2 = b[sortBy];
    if (typeof v1 === 'string' && typeof v2 === 'string') {
      v1 = v1.toLowerCase();
      v2 = v2.toLowerCase();
    }
    if (v1 < v2) return sortOrder === 'asc' ? -1 : 1;
    if (v1 > v2) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  };

  // Filtrage/recherche
  const filteredCatalogue = catalogue.filter(item => {
    const searchText = search.toLowerCase();
    const matchSearch =
      item.libelle.toLowerCase().includes(searchText) ||
      item.ref.toLowerCase().includes(searchText) ||
      item.fournisseur.toLowerCase().includes(searchText);
    const matchFournisseur = filterFournisseur ? item.fournisseur === filterFournisseur : true;
    return matchSearch && matchFournisseur;
  });

  // Pagination
  const paginatedCatalogue = filteredCatalogue.sort(sortCatalogue).slice(page * rowsPerPage, (page + 1) * rowsPerPage);

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

  // Nouvelle version de fetchCatalogue qui prend un paramètre pour charger avec ou sans inactifs
  const fetchCatalogue = async (withInactive = false) => {
    const query = supabase
      .from('articles')
      .select('id, libelle, ref, fournisseur, prix_unitaire, url, active');
    if (!withInactive) {
      query.eq('active', true);
    }
    const { data } = await query;
    setCatalogue(data || []);
  };

  // Charger uniquement les actifs au montage
  useEffect(() => {
    fetchCatalogue(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gérer le toggle pour afficher/masquer les inactifs
  const handleToggleInactive = async () => {
    if (!showInactive) {
      await fetchCatalogue(true);
      setShowInactive(true);
    } else {
      await fetchCatalogue(false);
      setShowInactive(false);
    }
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
      // Vérification côté serveur : l'article est-il référencé dans des commandes passées ?
      const { data: isReferenced, error: refError } = await supabase.rpc('is_article_in_past_orders', {
        article_id: article.id
      });
      if (refError) throw refError;
      if (isReferenced) {
        // L'article est référencé : on le passe inactif et on duplique
        const { error: inactivateError } = await supabase
          .from('articles')
          .update({ active: false })
          .eq('id', article.id);
        if (inactivateError) throw inactivateError;
        // Création du nouvel article (copie avec modifs, active: true)
        const { data: newArticle, error: insertError } = await supabase
          .from('articles')
          .insert([
            {
              libelle: updatedData.libelle || article.libelle,
              ref: updatedData.ref || article.ref,
              fournisseur: updatedData.fournisseur || article.fournisseur,
              prix_unitaire: updatedData.prix_unitaire || article.prix_unitaire,
              url: updatedData.url || article.url,
              active: true
            }
          ])
          .select()
          .single();
        if (insertError) throw insertError;
        setEditSuccess(true);
        setEditError(null);
        setCatalogue(
          catalogue
            .map(item => item.id === article.id ? { ...item, active: false } : item)
            .concat(newArticle)
        );
        setTimeout(() => setEditSuccess(false), 3000);
        setDeleteInfo("L'article a été utilisé dans une commande : il a été dupliqué et l'original est passé inactif.");
        return;
      } else {
        // Update classique
        const { error } = await supabase
          .from('articles')
          .update({
            libelle: updatedData.libelle || article.libelle,
            ref: updatedData.ref || article.ref,
            fournisseur: updatedData.fournisseur || article.fournisseur,
            prix_unitaire: updatedData.prix_unitaire || article.prix_unitaire,
            url: updatedData.url || article.url
          })
          .eq('id', article.id)
          .select()
          .single();
        if (error) throw error;
        setCatalogue(
          catalogue.map(item =>
            item.id === article.id ? { ...item, ...updatedData } : item
          )
        );
        setEditSuccess(true);
        setEditError(null);
        setTimeout(() => setEditSuccess(false), 3000);
      }
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
      if (error) {
        if (error.code === '23503') {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ active: false })
            .eq('id', articleId);
          if (updateError) throw updateError;
          setDeleteInfo("L'article a été utilisé dans une commande, il a été désactivé (inactif).");
          setCatalogue(catalogue.map(item => item.id === articleId ? { ...item, active: false } : item));
        } else {
          throw error;
        }
      } else {
        const updatedCatalogue = catalogue.filter(item => item.id !== articleId);
        setCatalogue(updatedCatalogue);
        setDeleteSuccess(true);
        setTimeout(() => setDeleteSuccess(false), 3000);
      }
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
  
  const handleAddModalOpen = () => {
    setAddModalOpen(true);
    setAddArticleError(null);
    setAddArticleSuccess(false);
    setNewArticle({
      libelle: '',
      ref: '',
      fournisseur: '',
      prix_unitaire: 0,
      url: ''
    });
  };
  
  const handleAddModalClose = () => {
    setAddModalOpen(false);
  };
  
  const handleNewArticleChange = (field: keyof Omit<CatalogueItem, 'id'>) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'prix_unitaire'
      ? parseFloat(event.target.value) || 0
      : event.target.value;
    
    setNewArticle({
      ...newArticle,
      [field]: value
    });
  };
  
  const handleSaveNewArticle = async () => {
    // Validation basique
    if (!newArticle.libelle || !newArticle.ref || !newArticle.fournisseur || newArticle.prix_unitaire <= 0) {
      setAddArticleError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    setIsSubmitting(true);
    setAddArticleError(null);
    
    try {
      // Insérer le nouvel article dans la base de données
      const { error } = await supabase
        .from('articles')
        .insert([newArticle])
        .select();
        
      if (error) throw error;
      
      // Note: Nous ne pouvons pas directement modifier le catalogue ici car il est passé en props
      // L'article sera visible après un rechargement de la page ou une nouvelle requête
      
      setAddArticleSuccess(true);
      setTimeout(() => {
        handleAddModalClose();
        // Recharger la page pour afficher le nouvel article
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'article:', error);
      setAddArticleError('Une erreur est survenue lors de l\'ajout de l\'article');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>Catalogue</h1>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddModalOpen}
            sx={{ mr: 2 }}
          >
            Ajouter un article
          </Button>
          <Button
            variant={showInactive ? "outlined" : "text"}
            color="secondary"
            onClick={handleToggleInactive}
            sx={{ mr: 2 }}
          >
            {showInactive ? "Masquer les inactifs" : "Afficher les inactifs"}
          </Button>
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
      </Box>
      
      {/* Barres de recherche et de filtre */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Recherche"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Fournisseur</InputLabel>
          <Select
            value={filterFournisseur}
            label="Fournisseur"
            onChange={e => {
              setFilterFournisseur(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">Tous</MenuItem>
            {fournisseurs.map(f => (
              <MenuItem key={f} value={f}>{f}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Lignes/page</InputLabel>
          <Select
            value={rowsPerPage}
            label="Lignes/page"
            onChange={e => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
          >
            {[20, 50, 100].map(n => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <TableContainer component={Paper} sx={{ overflow: 'visible' }}>
        <Table aria-label="tableau du catalogue" sx={{ overflow: 'visible' }}>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => {
                setSortBy('libelle');
                setSortOrder(sortBy === 'libelle' && sortOrder === 'asc' ? 'desc' : 'asc');
              }} style={{ cursor: 'pointer' }}>
                Libellé {sortBy === 'libelle' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => {
                setSortBy('ref');
                setSortOrder(sortBy === 'ref' && sortOrder === 'asc' ? 'desc' : 'asc');
              }} style={{ cursor: 'pointer' }}>
                Référence {sortBy === 'ref' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => {
                setSortBy('fournisseur');
                setSortOrder(sortBy === 'fournisseur' && sortOrder === 'asc' ? 'desc' : 'asc');
              }} style={{ cursor: 'pointer' }}>
                Fournisseur {sortBy === 'fournisseur' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => {
                setSortBy('prix_unitaire');
                setSortOrder(sortBy === 'prix_unitaire' && sortOrder === 'asc' ? 'desc' : 'asc');
              }} style={{ cursor: 'pointer' }}>
                Prix unitaire {sortBy === 'prix_unitaire' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedCatalogue
              .map((item) => (
                <TableRow key={item.libelle} sx={{ ...(item.active === false ? { opacity: 0.5, backgroundColor: '#f5f5f5' } : {}), overflow: 'visible' }}>
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
                  <TableCell sx={{ position: 'relative', minWidth: 90, overflow: 'visible' }}>
                    {/* Bouton + dans un cercle bleu, à cheval sur le bord droit */}
                    <Box
                      sx={{
                        position: 'absolute',
                        right: -22,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                        pointerEvents: 'auto',
                      }}
                    >
                      <IconButton
                        aria-label={`Ajouter ${item.libelle}`}
                        onClick={() => handleAddArticle(item.libelle)}
                        disabled={item.active === false}
                        sx={{
                          backgroundColor: 'primary.main',
                          color: 'white',
                          boxShadow: 2,
                          width: 40,
                          height: 40,
                          border: '2px solid white',
                          '&:hover': {
                            backgroundColor: 'primary.dark',
                          },
                        }}
                        size="large"
                      >
                        <AddIcon fontSize="medium" />
                      </IconButton>
                    </Box>
                    {/* Boutons edit/delete réduits, alignés à droite */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <IconButton
                        color="primary"
                        aria-label={`Éditer ${item.libelle}`}
                        onClick={() => {
                          setArticleToEdit(item);
                          setEditData(item);
                          setEditModalOpen(true);
                        }}
                        disabled={item.active === false}
                        size="small"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        color="error"
                        aria-label={`Supprimer ${item.libelle}`}
                        onClick={() => {
                          setArticleToDelete(item.id);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={item.active === false}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1, gap: 2 }}>
        <Typography variant="body2">
          {filteredCatalogue.length === 0
            ? 'Aucun article'
            : `Page ${page + 1} sur ${Math.ceil(filteredCatalogue.length / rowsPerPage)}`}
        </Typography>
        <Button
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
        >
          Précédent
        </Button>
        <Button
          onClick={() => setPage(page + 1)}
          disabled={(page + 1) * rowsPerPage >= filteredCatalogue.length}
        >
          Suivant
        </Button>
      </Box>

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
      
      {/* Modale d'ajout d'article */}
      <Dialog open={addModalOpen} onClose={handleAddModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un nouvel article</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              label="Libellé"
              fullWidth
              margin="normal"
              value={newArticle.libelle}
              onChange={handleNewArticleChange('libelle')}
              required
            />
            <TextField
              label="Référence"
              fullWidth
              margin="normal"
              value={newArticle.ref}
              onChange={handleNewArticleChange('ref')}
              required
            />
            <TextField
              label="Fournisseur"
              fullWidth
              margin="normal"
              value={newArticle.fournisseur}
              onChange={handleNewArticleChange('fournisseur')}
              required
            />
            <TextField
              label="Prix unitaire (€)"
              fullWidth
              margin="normal"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={newArticle.prix_unitaire}
              onChange={handleNewArticleChange('prix_unitaire')}
              required
            />
            <TextField
              label="URL (optionnel)"
              fullWidth
              margin="normal"
              value={newArticle.url}
              onChange={handleNewArticleChange('url')}
            />
            
            {addArticleError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {addArticleError}
              </Alert>
            )}
            
            {addArticleSuccess && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Article ajouté avec succès !
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddModalClose} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleSaveNewArticle}
            color="primary"
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Affichage du message d'info suppression/désactivation */}
      {deleteInfo && (
        <Alert severity="info" sx={{ mt: 2 }} onClose={() => setDeleteInfo(null)}>
          {deleteInfo}
        </Alert>
      )}
    </div>
  )
}
