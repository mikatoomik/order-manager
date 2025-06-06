// Interface pour les articles du catalogue
export interface CatalogueItem {
  id: string;
  libelle: string;
  ref: string;
  fournisseur: string;
  prix_unitaire: number;
  url: string;
  active?: boolean;
}

// Interface pour les articles avec quantité dans le panier
export interface CartItem {
  libelle: string;
  quantite: number;
}

// Profil utilisateur minimal
export interface UserProfile {
  avatar_url: string | null;
  nickname: string | null;
}

// Cercle utilisateur minimal
export interface UserCircle {
  id: string;
  nom: string;
}