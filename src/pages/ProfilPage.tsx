import type { User } from '@supabase/supabase-js'
import type { UserProfile, UserCircle } from '../testData'

interface ProfilPageProps {
  user: User;
  userProfile: UserProfile | null;
  userCircles: UserCircle[];
}

export default function ProfilPage({ user, userProfile, userCircles }: ProfilPageProps) {
  return (
    <div>
      <h1>Mon profil</h1>
      <p data-testid="profil-email">Connecté en tant que <b>{user.email}</b></p>
      <p data-testid="profil-displayname">Nom affiché : <b>{user.user_metadata?.full_name || '—'}</b></p>
      {/* Avatar et surnom */}
      {userProfile && userProfile.avatar_url && (
        <div>
          <img data-testid="profil-avatar" src={userProfile.avatar_url} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%' }} />
        </div>
      )}
      {userProfile && (
        <p data-testid="profil-nickname">Surnom : <b>{userProfile.nickname || '—'}</b></p>
      )}
      {/* Cercles d'appartenance */}
      <div>
        <p>Cercles d’appartenance :</p>
        <ul data-testid="profil-cercles">
          {userCircles.length === 0 && <li>Aucun cercle</li>}
          {userCircles.map((c, i) => <li key={i}>{c.nom}</li>)}
        </ul>
      </div>
    </div>
  )
}
