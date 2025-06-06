import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserCircle } from '../testData';
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
        .select('nom');

      if (allCirclesError) {
        console.error('Error fetching all circles:', allCirclesError);
      } else {
        setAllCircles(allCirclesData ? allCirclesData.map((c: { nom: string }) => ({ nom: c.nom })) : []);
      }

      const { data: userCirclesData, error: userCirclesError } = await supabase
        .from('user_circles')
        .select('circle_name')
        .eq('user_id', user.id);

      if (userCirclesError) {
        console.error('Error fetching user circles:', userCirclesError);
      } else {
        setSelectedCircles(userCirclesData ? userCirclesData.map((c: { circle_name: string }) => ({ nom: c.circle_name })) : []);
      }
    };

    fetchAllCircles();
  }, [user.id]);

  const handleCircleClick = async (circle: UserCircle) => {
    const isSelected = selectedCircles.some((c) => c.nom === circle.nom);

    if (isSelected) {
      // Remove circle from user_circles
      const { error } = await supabase
        .from('user_circles')
        .delete()
        .eq('user_id', user.id)
        .eq('circle_name', circle.nom);

      if (error) {
        console.error('Error removing user circle:', error);
      } else {
        setSelectedCircles(selectedCircles.filter((c) => c.nom !== circle.nom));
      }
    } else {
      // Add circle to user_circles
      const { error } = await supabase
        .from('user_circles')
        .insert([{ user_id: user.id, circle_name: circle.nom }]);

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
        <p data-testid="profil-nickname">Surnom : <b>{userProfile.nickname || '—'}</b></p>
      )}
      {/* Cercles d'appartenance */}
      <div>
        <p>Cercles d’appartenance :</p>
        <div data-testid="profil-cercles">
          {allCircles.map((circle) => (
            <Chip
              key={circle.nom}
              label={circle.nom}
              onClick={() => handleCircleClick(circle)}
              color={selectedCircles.some((c) => c.nom === circle.nom) ? 'primary' : 'default'}
              style={{ margin: '4px' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
