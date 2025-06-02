import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'
import './App.css'

function getTestUser(): User {
  return {
    id: 'test-user-id',
    aud: 'authenticated',
    email: 'testuser@lica-europe.org',
    phone: '',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
    identities: [],
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  };
}

function App() {
  const [showLogin, setShowLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [articles, setArticles] = useState<string[]>([])
  const [page, setPage] = useState<'demandes' | 'catalogue' | 'profil'>('demandes')
  const [catalogue, setCatalogue] = useState<string[]>([])
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // Détection de l'utilisateur connecté
  useEffect(() => {
    // Mode test : simule un utilisateur connecté si ?test=1 dans l’URL
    if (window.location.search.includes('test=1')) {
      setUser(getTestUser());
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
            <div>
              <h1>Mes demandes</h1>
              {articles.length === 0 ? (
                <p>Aucune demande</p>
              ) : (
                <ul>
                  {articles.map(a => <li key={a}>{a}</li>)}
                </ul>
              )}
              <button onClick={() => setShowModal(true)}>Ajouter un article</button>
              {showModal && (
                <div role="dialog" style={{ background: '#fff', border: '1px solid #ccc', padding: 16, marginTop: 16 }}>
                  <form onSubmit={e => {
                    e.preventDefault();
                    const select = (e.target as HTMLFormElement).elements.namedItem('article-select') as HTMLSelectElement;
                    setArticles([...articles, select.value]);
                    setShowModal(false);
                  }}>
                    <label htmlFor="article-select">Article</label>
                    <select id="article-select" name="article-select" aria-label="Article" defaultValue={catalogue[0] || ''}>
                      {catalogue.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <button type="submit">Valider</button>
                  </form>
                </div>
              )}
            </div>
          )}
          {page === 'catalogue' && (
            <div>
              <h1>Catalogue</h1>
              <ul>
                {catalogue.map(a => (
                  <li key={a}>
                    {a} <button onClick={() => setArticles([...articles, a])}>Ajouter {a}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {page === 'profil' && (
            <div>
              <h1>Mon profil</h1>
              <p data-testid="profil-email">Connecté en tant que <b>{user.email}</b></p>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}

export default App
