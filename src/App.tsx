import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import './App.css';
import { getTestProfile } from './testData.ts';
import type { UserProfile } from './types';
import type { CatalogueItem, CartItem } from './types';
import ProfilPage from './pages/ProfilPage';
import CommandesPage from './pages/CommandesPage';
import PeriodesPage from './pages/PeriodesPage';
import CerclesPage from './pages/CerclesPage';
import CataloguePage from './pages/CataloguePage';
import { Button, Container, Box, Typography, AppBar, Toolbar, BottomNavigation, BottomNavigationAction } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { createNextPeriodIfNeeded } from './utils/periodUtils';

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [articles, setArticles] = useState<CartItem[]>([])
  const [page, setPage] = useState<'cercles' | 'catalogue' | 'profil' | 'commandes' | 'periodes'>('catalogue');
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([])
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isFinAdmin, setIsFinAdmin] = useState(false);

  // Détection de l'utilisateur connecté
  useEffect(() => {
    // Mode test : simule un utilisateur connecté si ?test=1 dans l’URL
    if (window.location.search.includes('test=1')) {
      setUser({
        id: 'test-user-id',
        email: 'test@lica.org',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        identities: [],
        last_sign_in_at: new Date().toISOString(),
        phone: undefined,
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: undefined,
        factors: undefined,
      });
      setUserProfile(getTestProfile());
      setShowLogin(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
      if (data?.user) setShowLogin(false)
    })
    // Écouteur d'état d'auth
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setShowLogin(false)
      else setShowLogin(true)
    })
    return () => { listener?.subscription.unsubscribe() }
  }, [])

  // Vérifie/crée la prochaine période au lancement de l'app
  useEffect(() => {
    createNextPeriodIfNeeded();
  }, []);

  // Récupération des articles depuis Supabase
  useEffect(() => {
    if (page === 'catalogue' && showLogin === false) {
      supabase
        .from('articles')
        .select('id, libelle, ref, fournisseur, prix_unitaire, url, active')
        .eq('active', true)
        .then(({ data }) => {
          setCatalogue(data || [])
        })
    }
  }, [page, showLogin])

  // Récupération du profil enrichi et des cercles à l'ouverture de la page profil
  useEffect(() => {
    if (page === 'profil' && user && !window.location.search.includes('test=1')) {
      // Récupérer avatar et surnom
      supabase.from('user_profiles').select('avatar_url, nickname').eq('user_id', user.id).single().then(({ data, error }) => {
        if (error) {
          console.error('Erreur Supabase user_profiles:', error);
        }
        setUserProfile(data ?? { avatar_url: null, nickname: null });
      });
    }
  }, [page, user]);

  // Vérification des droits FinAdmin
  useEffect(() => {
    if (user) {
      supabase
        .from('user_circles')
        .select('circles(id, nom)')
        .eq('user_id', user.id)
        .then(({ data }) => {
          const circles = (data || []).map((item) => Array.isArray(item.circles) ? item.circles[0] : item.circles).filter(Boolean);
          setIsFinAdmin(circles.some((c) => c.nom === 'FinAdmin'));
        });
    }
  }, [user]);

  // Création automatique du user_profile à la première connexion
  useEffect(() => {
    if (user && user.email) {
      supabase
        .from('user_profiles')
        .select('nickname')
        .eq('user_id', user.id)
        .single()
        .then(async ({ data, error }) => {
          if (!data && !error) {
            // Récupère le display name et l'avatar Google si dispo
            const nickname = user.user_metadata?.full_name || user.email;
            let avatar_url = null;
            if (user.user_metadata?.avatar_url) {
              avatar_url = user.user_metadata.avatar_url;
            } else if (user.user_metadata?.picture) {
              avatar_url = user.user_metadata.picture;
            }
            await supabase.from('user_profiles').insert({ user_id: user.id, nickname, avatar_url });
            setUserProfile({ avatar_url, nickname });
          }
        });
    }
  }, [user, setUserProfile]);

  // Gestion Google Auth
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: import.meta.env.VITE_GOOGLE_REDIRECT,
      },
    });
    if (error) setAuthMessage("Erreur lors de la connexion Google : " + error.message);
  };

  const pages = [
    { label: 'Cercles', value: 'cercles', icon: <RestoreIcon /> },
    { label: 'Catalogue', value: 'catalogue', icon: <FavoriteIcon /> },
    { label: 'Commandes', value: 'commandes', icon: <ListAltIcon /> },
    { label: 'Profil', value: 'profil', icon: <LocationOnIcon /> },
  ];
  if (isFinAdmin) {
    pages.splice(3, 0, { label: 'Périodes', value: 'periodes', icon: <ListAltIcon /> });
  }

  return (
    <>
      <AppBar position="fixed" style={{ backgroundColor: '#f5f5f5', color: '#333', height: '30px' }}>
        <Toolbar style={{ minHeight: '30px' }}>
          <Typography variant="h6" style={{ flexGrow: 1, color: '#333', fontSize: '1rem' }}>
            {user ? `Connecté en tant que ${user.email}` : 'Non connecté'}
          </Typography>
          {user && (
            <Button color="inherit" onClick={async () => { await supabase.auth.signOut(); setUser(null); setShowLogin(true); setAuthMessage(null); }} style={{ fontSize: '0.8rem' }}>
              Se déconnecter
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" style={{ paddingTop: '30px', paddingBottom: '56px' }}>
        {showLogin && !user && (
          <Box mt={2}>
            <Button variant="contained" color="primary" onClick={handleGoogleLogin} aria-label="Se connecter avec Google">
              Se connecter avec Google
            </Button>
          </Box>
        )}
        {!showLogin && !user && (
          <form onSubmit={async e => {
            e.preventDefault();
            setAuthMessage('Merci d’utiliser le bouton Google pour vous connecter.');
          }}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled />
            <Button type="submit" disabled>Envoyer le lien</Button>
          </form>
        )}
        {authMessage && <Typography color="error">{authMessage}</Typography>}
        {user && (
          <>
            {page === 'cercles' && (
              <CerclesPage user={user} />
            )}
            {page === 'catalogue' && (
              <CataloguePage
                catalogue={catalogue}
                setCatalogue={setCatalogue}
                articles={articles}
                setArticles={setArticles}
                user={user}
              />
            )}
            {page === 'profil' && (
              <ProfilPage
                user={user}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
              />
            )}
            {page === 'commandes' && (
              <CommandesPage />
            )}
            {isFinAdmin && page === 'periodes' && (
              <PeriodesPage user={user} />
            )}
          </>
        )}
      </Container>
      <AppBar position="fixed" style={{ top: 'auto', bottom: 0 }}>
        <BottomNavigation
          value={page}
          onChange={(_event, newValue) => {
            setPage(newValue);
          }}
          showLabels
        >
          {pages.map((p) => (
            <BottomNavigationAction key={p.value} label={p.label} value={p.value} icon={p.icon} />
          ))}
        </BottomNavigation>
      </AppBar>
    </>
  );
}

export default App;
