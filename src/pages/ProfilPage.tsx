import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserCircle } from '../types';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Chip } from '@mui/material';

interface ProfilPageProps {
  user: User;
  userProfile: UserProfile | null;
}

export default function ProfilPage({ user, userProfile }: ProfilPageProps) {
  const [allCircles, setAllCircles] = useState<UserCircle[]>([]);
  const [selectedCircles, setSelectedCircles] = useState<UserCircle[]>([]);

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
        <div style={{ marginBottom: 16 }}>
          <p data-testid="profil-nickname">
            Surnom :
            <input
              type="text"
              value={userProfile.nickname || ''}
              onChange={async (e) => {
                const newNickname = e.target.value;
                // Met à jour en base
                const { error } = await supabase
                  .from('user_profiles')
                  .update({ nickname: newNickname })
                  .eq('user_id', user.id);
                if (!error) {
                  // Met à jour localement
                  userProfile.nickname = newNickname;
                }
              }}
              style={{ marginLeft: 8, fontWeight: 'bold', fontSize: 16 }}
            />
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              data-testid="profil-avatar"
              src={userProfile.avatar_url ? userProfile.avatar_url : ('https://ui-avatars.com/api/?name=' + encodeURIComponent(userProfile.nickname || user.email || ''))}
              alt="avatar"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Upload sur Supabase Storage (bucket 'avatars')
                const fileExt = file.name.split('.').pop();
                const filePath = `${user.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                if (!uploadError) {
                  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                  const publicUrl = data.publicUrl;
                  // Met à jour l'URL en base
                  await supabase.from('user_profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
                  userProfile.avatar_url = publicUrl;
                }
              }}
            />
          </div>
        </div>
      )}
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
