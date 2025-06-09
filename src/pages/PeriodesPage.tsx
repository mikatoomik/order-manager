import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, Typography, Box, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import type { User } from '@supabase/supabase-js';
import type { Period } from '../utils/periodUtils';
import type { UserCircle } from '../types';

interface PeriodesPageProps {
  user: User;
}

const ETATS = ['open', 'ordered', 'closed', 'archived'];

export default function PeriodesPage({ user }: PeriodesPageProps) {
  const [periodes, setPeriodes] = useState<Period[]>([]);
  const [isFinAdmin, setIsFinAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newDateLimite, setNewDateLimite] = useState('');

  useEffect(() => {
    fetchPeriodes();
    checkFinAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPeriodes() {
    const { data, error } = await supabase
      .from('order_periods')
      .select('*')
      .order('date_limite', { ascending: false });
    if (error) setError('Erreur lors du chargement des périodes');
    setPeriodes(data || []);
  }

  async function checkFinAdmin() {
    const { data, error } = await supabase
      .from('user_circles')
      .select('circles(id, nom)')
      .eq('user_id', user.id);
    if (error) return setIsFinAdmin(false);
    const circles: UserCircle[] = (data || [])
      .map((item: { circles: UserCircle[] | UserCircle }) => Array.isArray(item.circles) ? item.circles[0] : item.circles)
      .filter(Boolean);
    setIsFinAdmin(circles.some((c) => c.nom === 'FinAdmin'));
  }

  async function creerPeriode() {
    setError(null); setSuccess(null);
    if (!newNom || !newDateLimite) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await supabase
      .from('order_periods')
      .insert([{ nom: newNom, date_limite: newDateLimite, status: 'open' }]);
    if (error) setError('Erreur lors de la création');
    else {
      setSuccess('Période créée');
      setOpenModal(false);
      setNewNom('');
      setNewDateLimite('');
      fetchPeriodes();
    }
  }

  async function changerEtat(id: string, status: string) {
    setError(null); setSuccess(null);
    const { error } = await supabase
      .from('order_periods')
      .update({ status })
      .eq('id', id);
    if (error) setError('Erreur lors du changement d\'état');
    else { setSuccess('État modifié'); fetchPeriodes(); }
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Périodes de commande</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {isFinAdmin && (
        <Button variant="contained" color="primary" sx={{ mb: 2 }} onClick={() => setOpenModal(true)}>
          Créer une nouvelle période
        </Button>
      )}
      <Dialog open={openModal} onClose={() => setOpenModal(false)}>
        <DialogTitle>Créer une nouvelle période</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la période"
            fullWidth
            value={newNom}
            onChange={e => setNewNom(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Date limite"
            type="date"
            fullWidth
            value={newDateLimite}
            onChange={e => setNewDateLimite(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Annuler</Button>
          <Button onClick={creerPeriode} variant="contained">Créer</Button>
        </DialogActions>
      </Dialog>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Date limite</TableCell>
              <TableCell>État</TableCell>
              {isFinAdmin && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {periodes
              .sort((a, b) => new Date(b.date_limite).getTime() - new Date(a.date_limite).getTime())
              .map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nom}</TableCell>
                  <TableCell>{p.date_limite}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  {isFinAdmin && (
                    <TableCell>
                      <Select
                        value={p.status}
                        onChange={e => changerEtat(p.id, e.target.value)}
                        size="small"
                      >
                        {ETATS.map(etat => <MenuItem key={etat} value={etat}>{etat}</MenuItem>)}
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
