import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserCircle } from '../types';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

interface ProfilPageProps {
  user: User;
  userProfile: UserProfile | null;
}

export default function ProfilPage({ user, userProfile }: ProfilPageProps) {
  const [allCircles, setAllCircles] = useState<UserCircle[]>([]);
  const [selectedCircles, setSelectedCircles] = useState<UserCircle[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editNickname, setEditNickname] = useState(userProfile?.nickname || '');
  const [editAvatar, setEditAvatar] = useState(userProfile?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAllCircles = async () => {
      const { data: allCirclesData, error: allCirclesError } = await supabase
        .from('circles')
        .select('id, nom');

      if (allCirclesError) {
        console.error('Error fetching all circles:', allCirclesError);
        setAllCircles([]);
        setSelectedCircles([]);
        return;
      }
      const allCirclesList = allCirclesData ? allCirclesData.map((c: { id: string, nom: string }) => ({ id: c.id, nom: c.nom })) : [];
      setAllCircles(allCirclesList);

      const { data: userCirclesData, error: userCirclesError } = await supabase
        .from('user_circles')
        .select('circle_id')
        .eq('user_id', user.id);

      if (userCirclesError) {
        console.error('Error fetching user circles:', userCirclesError);
        setSelectedCircles([]);
      } else {
        setSelectedCircles(userCirclesData ? userCirclesData.map((c: { circle_id: string }) => {
          const found = allCirclesList.find(ac => ac.id === c.circle_id);
          return found ? found : { id: c.circle_id, nom: c.circle_id };
        }) : []);
      }
    };
    fetchAllCircles();
  }, [user.id]);

  const handleCircleClick = async (circle: UserCircle) => {
    const isSelected = selectedCircles.some((c) => c.id === circle.id);

    if (isSelected) {
      // Remove circle from user_circles
      const { error } = await supabase
        .from('user_circles')
        .delete()
        .eq('user_id', user.id)
        .eq('circle_id', circle.id);

      if (error) {
        console.error('Error removing user circle:', error);
      } else {
        setSelectedCircles(selectedCircles.filter((c) => c.id !== circle.id));
      }
    } else {
      // Add circle to user_circles
      const { error } = await supabase
        .from('user_circles')
        .insert([{ user_id: user.id, circle_id: circle.id }]);

      if (error) {
        console.error('Error adding user circle:', error);
      } else {
        setSelectedCircles([...selectedCircles, circle]);
      }
    }
  };

  // Ouvre la modale d'édition
  const openEditModal = () => {
    setEditNickname(userProfile?.nickname || '');
    setEditAvatar(userProfile?.avatar_url || '');
    setEditOpen(true);
  };

  // Sauvegarde les modifications
  const handleSaveProfile = async () => {
    setSaving(true);
    await supabase.from('user_profiles').update({ nickname: editNickname, avatar_url: editAvatar }).eq('user_id', user.id);
    setEditOpen(false);
    setSaving(false);
    // Rafraîchir l'affichage local
    if (userProfile) {
      userProfile.nickname = editNickname;
      userProfile.avatar_url = editAvatar;
    }
  };

  return (
    <div>
      <h1>Mon profil</h1>
      <p data-testid="profil-email">Connecté en tant que <b>{user.email}</b></p>
      <p data-testid="profil-displayname">Nom affiché : <b>{user.user_metadata?.full_name || '—'}</b></p>
      {/* Avatar et surnom */}
      {userProfile && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            data-testid="profil-avatar"
            src={userProfile.avatar_url ? userProfile.avatar_url : ('https://ui-avatars.com/api/?name=' + encodeURIComponent(userProfile.nickname || user.email || ''))}
            alt="avatar"
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }}
          />
          <span style={{ fontWeight: 'bold', fontSize: 16 }}>{userProfile.nickname || '—'}</span>
          <IconButton aria-label="modifier le profil" onClick={openEditModal} size="small">
            <EditIcon fontSize="small" />
          </IconButton>
        </div>
      )}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Modifier le profil</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
          <TextField
            label="Surnom"
            value={editNickname}
            onChange={e => setEditNickname(e.target.value)}
            fullWidth
          />
          <TextField
            label="URL de l'avatar"
            value={editAvatar}
            onChange={e => setEditAvatar(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <button onClick={() => setEditOpen(false)}>Annuler</button>
          <button onClick={handleSaveProfile} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </DialogActions>
      </Dialog>
      {/* Cercles d'appartenance */}
      <div>
        <p>Cercles d’appartenance :</p>
        <div data-testid="profil-cercles">
          {allCircles.map((circle) => {
            const isUserCircle = selectedCircles.some((c) => c.id === circle.id);
            let customColor = undefined;
            if (isUserCircle) {
              switch (circle.nom) {
                case 'IA': customColor = '#ffc578'; break;
                case 'IC': customColor = '#eeaeff'; break;
                case 'TES': customColor = '#9fffb0'; break;
                case 'Commun': customColor = '#9da7f9'; break;
                case 'FinAdmin': customColor = '#fffbb0'; break;
                default: customColor = undefined;
              }
            }
            return (
              <Chip
                key={circle.nom}
                label={circle.nom}
                onClick={() => handleCircleClick(circle)}
                style={{
                  margin: '4px',
                  backgroundColor: isUserCircle && customColor ? customColor : undefined,
                  fontWeight: isUserCircle ? 600 : 400,
                  color: isUserCircle && customColor ? '#222' : undefined,
                  cursor: 'pointer',
                  opacity: 1
                }}
                variant={isUserCircle ? 'filled' : 'outlined'}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
