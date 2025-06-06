import { useState } from 'react';
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
  Button
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LinkIcon from '@mui/icons-material/Link';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import type { CatalogueItem, CartItem } from '../types';

interface CataloguePageProps {
  catalogue: CatalogueItem[];
  articles: CartItem[];
  setArticles: (a: CartItem[]) => void;
}

export default function CataloguePage({ catalogue, articles, setArticles }: CataloguePageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
          )}
        </Box>
      </Drawer>
    </div>
  )
}
