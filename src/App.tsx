import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { getTestUser, getTestProfile, getTestCircles } from './testData.ts'
import type { UserProfile, UserCircle } from './testData.ts'
import ProfilPage from './pages/ProfilPage'
import DemandesPage from './pages/DemandesPage'
import CataloguePage from './pages/CataloguePage'

function App() {
  const [showLogin, setShowLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [articles, setArticles] = useState<string[]>([])
  const [page, setPage] = useState<'demandes' | 'catalogue' | 'profil'>('demandes')
  const [catalogue, setCatalogue] = useState<string[]>([])
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userCircles, setUserCircles] = useState<UserCircle[]>([]);

  // Détection de l'utilisateur connecté
  useEffect(() => {
    // Mode test : simule un utilisateur connecté si ?test=1 dans l’URL
    if (window.location.search.includes('test=1')) {
      setUser(getTestUser());
      setUserProfile(getTestProfile());
      setUserCircles(getTestCircles());
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

  // Récupération des articles depuis Supabase
  useEffect(() => {
    if (page === 'catalogue' && showLogin === false) {
      supabase.from('articles').select('libelle').then(({ data }) => {
        setCatalogue(data ? data.map((a: { libelle: string }) => a.libelle) : [])
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
      // Récupérer les cercles
      supabase.from('user_circles').select('circles(nom)').eq('user_id', user.id).then(({ data, error }) => {
        if (error) {
          console.error('Erreur Supabase user_circles:', error);
        }
        if (Array.isArray(data)) {
          const circles: UserCircle[] = [];
          for (const row of data) {
            const c = (row as { circles?: { nom?: string } | null }).circles;
            if (c && typeof c === 'object' && typeof c.nom === 'string') {
              circles.push({ nom: c.nom });
            }
          }
          setUserCircles(circles);
        } else {
          setUserCircles([]);
        }
      });
    }
  }, [page, user]);

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

  return (
    <div style={{ padding: 32 }}>
      {showLogin && !user && (
        <div>
          <button onClick={handleGoogleLogin} aria-label="Se connecter avec Google">Se connecter avec Google</button>
        </div>
      )}
      {!showLogin && !user && (
        <form onSubmit={async e => {
          e.preventDefault();
          setAuthMessage('Merci d’utiliser le bouton Google pour vous connecter.');
        }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled />
          <button type="submit" disabled>Envoyer le lien</button>
        </form>
      )}
      {authMessage && <p>{authMessage}</p>}
      {user && (
        <>
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', background: '#f5f5f5', borderTop: '1px solid #ccc', padding: 12, textAlign: 'center', zIndex: 100 }}>
          <span>Connecté en tant que <b>{user.email}</b></span>
          <button style={{ marginLeft: 16 }} onClick={async () => { await supabase.auth.signOut(); setUser(null); setShowLogin(true); setAuthMessage(null); }}>Se déconnecter</button>
        </div>
        <div>
          <nav style={{ marginBottom: 16 }}>
            <a href="#" onClick={e => { e.preventDefault(); setPage('demandes'); }} role="link">Mes demandes</a> |
            <a href="#" onClick={e => { e.preventDefault(); setPage('catalogue'); }} role="link">Catalogue</a> |
            <a href="#" onClick={e => { e.preventDefault(); setPage('profil'); }} role="link">Profil</a>
          </nav>
          {page === 'demandes' && (
            <DemandesPage
              articles={articles}
              setArticles={setArticles}
              showModal={showModal}
              setShowModal={setShowModal}
              catalogue={catalogue}
            />
          )}
          {page === 'catalogue' && (
            <CataloguePage
              catalogue={catalogue}
              articles={articles}
              setArticles={setArticles}
            />
          )}
          {page === 'profil' && (
            <ProfilPage
              user={user}
              userProfile={userProfile}
              userCircles={userCircles}
            />
          )}
        </div>
        </>
      )}
    </div>
  )
}

export default App
