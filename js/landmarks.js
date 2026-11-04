/* Do I Mog or Dog — landmark definitions, template seeds and guide connections */
(function (M) {
  'use strict';

  // t = template position inside the face box (x: 0–1 across, y: 0–1 down).
  // Frontal "Left_*" is the SUBJECT's left, which appears on the image RIGHT in a non-mirrored photo.
  const FRONTAL = [
    { id: 'Hairline_Trichion', abbr: 'Tr', name: 'Trichion', group: 'Midline', desc: 'Center of the hairline on the facial midline.', t: [0.5, 0.085] },
    { id: 'Glabella', abbr: 'G', name: 'Glabella', group: 'Midline', desc: 'Most prominent point between the eyebrows.', t: [0.5, 0.33] },
    { id: 'Subnasale', abbr: 'Sn', name: 'Subnasale', group: 'Midline', desc: 'Base of the nose where the septum meets the philtrum.', t: [0.5, 0.575] },
    { id: 'Menton', abbr: 'Me', name: 'Menton', group: 'Midline', desc: 'Lowest point of the chin contour.', t: [0.5, 0.82] },
    { id: 'Left_Inner_Canthus', abbr: 'En·L', name: 'Left Inner Canthus', group: 'Eyes', desc: 'Medial corner of the subject\'s left eye (image right).', t: [0.577, 0.40] },
    { id: 'Right_Inner_Canthus', abbr: 'En·R', name: 'Right Inner Canthus', group: 'Eyes', desc: 'Medial corner of the subject\'s right eye (image left).', t: [0.423, 0.40] },
    { id: 'Left_Outer_Canthus', abbr: 'Ex·L', name: 'Left Outer Canthus', group: 'Eyes', desc: 'Lateral corner of the subject\'s left eye.', t: [0.732, 0.39] },
    { id: 'Right_Outer_Canthus', abbr: 'Ex·R', name: 'Right Outer Canthus', group: 'Eyes', desc: 'Lateral corner of the subject\'s right eye.', t: [0.268, 0.39] },
    { id: 'Left_Pupil', abbr: 'P·L', name: 'Left Pupil', group: 'Eyes', desc: 'Center of the subject\'s left pupil.', t: [0.655, 0.40] },
    { id: 'Right_Pupil', abbr: 'P·R', name: 'Right Pupil', group: 'Eyes', desc: 'Center of the subject\'s right pupil.', t: [0.345, 0.40] },
    { id: 'Left_Upper_Eyelid', abbr: 'Ps·L', name: 'Left Upper Eyelid', group: 'Eyes', desc: 'Top margin of the left upper eyelid, above the pupil.', t: [0.655, 0.383] },
    { id: 'Right_Upper_Eyelid', abbr: 'Ps·R', name: 'Right Upper Eyelid', group: 'Eyes', desc: 'Top margin of the right upper eyelid, above the pupil.', t: [0.345, 0.383] },
    { id: 'Left_Lower_Eyelid', abbr: 'Pi·L', name: 'Left Lower Eyelid', group: 'Eyes', desc: 'Bottom margin of the left lower eyelid, below the pupil.', t: [0.655, 0.418] },
    { id: 'Right_Lower_Eyelid', abbr: 'Pi·R', name: 'Right Lower Eyelid', group: 'Eyes', desc: 'Bottom margin of the right lower eyelid, below the pupil.', t: [0.345, 0.418] },
    { id: 'Left_Zygoma', abbr: 'Zy·L', name: 'Left Zygoma', group: 'Cheekbones', desc: 'Widest point of the left lateral cheekbone.', t: [0.90, 0.445] },
    { id: 'Right_Zygoma', abbr: 'Zy·R', name: 'Right Zygoma', group: 'Cheekbones', desc: 'Widest point of the right lateral cheekbone.', t: [0.10, 0.445] },
    { id: 'Left_Gonion', abbr: 'Go·L', name: 'Left Gonion', group: 'Jaw', desc: 'Outer angle of the lower jaw, left side.', t: [0.84, 0.70] },
    { id: 'Right_Gonion', abbr: 'Go·R', name: 'Right Gonion', group: 'Jaw', desc: 'Outer angle of the lower jaw, right side.', t: [0.16, 0.70] },
    { id: 'Left_Alar', abbr: 'Al·L', name: 'Left Alar', group: 'Nose', desc: 'Widest point of the left nostril wing.', t: [0.59, 0.555] },
    { id: 'Right_Alar', abbr: 'Al·R', name: 'Right Alar', group: 'Nose', desc: 'Widest point of the right nostril wing.', t: [0.41, 0.555] },
    { id: 'Left_Cheilion', abbr: 'Ch·L', name: 'Left Cheilion', group: 'Mouth', desc: 'Outer corner of the mouth, left side.', t: [0.63, 0.655] },
    { id: 'Right_Cheilion', abbr: 'Ch·R', name: 'Right Cheilion', group: 'Mouth', desc: 'Outer corner of the mouth, right side.', t: [0.37, 0.655] },
    { id: 'Labiale_Superius', abbr: 'Ls', name: 'Labiale Superius', group: 'Mouth', desc: 'Midpoint of the upper lip\'s top border (vermilion).', t: [0.5, 0.63] },
    { id: 'Labiale_Inferius', abbr: 'Li', name: 'Labiale Inferius', group: 'Mouth', desc: 'Midpoint of the lower lip\'s bottom border.', t: [0.5, 0.705] },
  ];

  // Profile template faces RIGHT (anterior = +x); mirrored when the subject faces left.
  const PROFILE = [
    { id: 'Profile_Trichion', abbr: 'Tr′', name: 'Trichion', group: 'Cranial', desc: 'Top of the hairline in profile.', t: [0.60, 0.10] },
    { id: 'Profile_Glabella', abbr: 'G′', name: 'Glabella', group: 'Cranial', desc: 'Most prominent point of the forehead / brow bridge.', t: [0.66, 0.33] },
    { id: 'Profile_Nasion', abbr: 'N′', name: 'Nasion', group: 'Nose', desc: 'Deepest depression of the nasal bridge.', t: [0.645, 0.375] },
    { id: 'Profile_Nasal_Tip', abbr: 'Prn', name: 'Nasal Tip', group: 'Nose', desc: 'Most anterior point of the nose (pronasale).', t: [0.76, 0.545] },
    { id: 'Profile_Subnasale', abbr: 'Sn′', name: 'Subnasale', group: 'Nose', desc: 'Junction of the nasal septum and the upper lip.', t: [0.68, 0.57] },
    { id: 'Profile_Labiale_Superius', abbr: 'Ls′', name: 'Labiale Superius', group: 'Lips', desc: 'Most anterior point of the upper lip.', t: [0.70, 0.615] },
    { id: 'Profile_Labiale_Inferius', abbr: 'Li′', name: 'Labiale Inferius', group: 'Lips', desc: 'Most anterior point of the lower lip.', t: [0.69, 0.685] },
    { id: 'Profile_Mentolabial_Sulcus', abbr: 'Sm′', name: 'Mentolabial Sulcus', group: 'Lips', extra: true, desc: 'Deepest point of the crease between lower lip and chin. Needed for the mentolabial angle.', t: [0.65, 0.72] },
    { id: 'Profile_Pogonion', abbr: 'Pog′', name: 'Pogonion', group: 'Chin', desc: 'Most anterior point of the chin.', t: [0.67, 0.76] },
    { id: 'Profile_Menton', abbr: 'Me′', name: 'Menton', group: 'Chin', desc: 'Lowest point of the chin.', t: [0.62, 0.80] },
    { id: 'Profile_Gonion', abbr: 'Go′', name: 'Gonion', group: 'Mandible', desc: 'Posterior-inferior angle of the mandible.', t: [0.42, 0.732] },
    { id: 'Profile_Ramus_Top', abbr: 'Ra′', name: 'Ramus Top', group: 'Mandible', desc: 'Highest visible point of the vertical ramus (condyle junction, just in front of the ear).', t: [0.39, 0.50] },
    { id: 'Profile_Cornea', abbr: 'Co′', name: 'Cornea', group: 'Orbit', desc: 'Most anterior surface of the eye bulge.', t: [0.62, 0.43] },
    { id: 'Profile_Infraorbital_Rim', abbr: 'Or′', name: 'Infraorbital Rim', group: 'Orbit', desc: 'Bony rim under the lower eyelid, at its most anterior point.', t: [0.622, 0.47] },
    { id: 'Profile_Submental_Point', abbr: 'C′', name: 'Submental Point', group: 'Neck', desc: 'Junction where the underside of the chin meets the neck.', t: [0.50, 0.815] },
  ];

  const FRONTAL_CONN = [
    ['Hairline_Trichion', 'Glabella'], ['Glabella', 'Subnasale'], ['Subnasale', 'Labiale_Superius'], ['Labiale_Inferius', 'Menton'],
    ['Right_Outer_Canthus', 'Right_Inner_Canthus'], ['Left_Inner_Canthus', 'Left_Outer_Canthus'], ['Right_Pupil', 'Left_Pupil'],
    ['Right_Upper_Eyelid', 'Right_Lower_Eyelid'], ['Left_Upper_Eyelid', 'Left_Lower_Eyelid'],
    ['Right_Zygoma', 'Right_Gonion'], ['Right_Gonion', 'Menton'], ['Menton', 'Left_Gonion'], ['Left_Gonion', 'Left_Zygoma'],
    ['Right_Zygoma', 'Left_Zygoma'], ['Right_Alar', 'Left_Alar'],
    ['Right_Cheilion', 'Labiale_Superius'], ['Labiale_Superius', 'Left_Cheilion'], ['Left_Cheilion', 'Labiale_Inferius'], ['Labiale_Inferius', 'Right_Cheilion'],
  ];

  const PROFILE_CONN = [
    ['Profile_Trichion', 'Profile_Glabella'], ['Profile_Glabella', 'Profile_Nasion'], ['Profile_Nasion', 'Profile_Nasal_Tip'],
    ['Profile_Nasal_Tip', 'Profile_Subnasale'], ['Profile_Subnasale', 'Profile_Labiale_Superius'],
    ['Profile_Labiale_Superius', 'Profile_Labiale_Inferius'], ['Profile_Labiale_Inferius', 'Profile_Mentolabial_Sulcus'],
    ['Profile_Mentolabial_Sulcus', 'Profile_Pogonion'], ['Profile_Pogonion', 'Profile_Menton'], ['Profile_Menton', 'Profile_Submental_Point'],
    ['Profile_Ramus_Top', 'Profile_Gonion'], ['Profile_Gonion', 'Profile_Menton'], ['Profile_Cornea', 'Profile_Infraorbital_Rim'],
  ];

  const GROUP_COLORS = {
    Midline: '#00F0FF', Eyes: '#39FF14', Cheekbones: '#FF2BD6', Jaw: '#FFB020', Nose: '#A98BFF', Mouth: '#FF5C7A',
    Cranial: '#00F0FF', Lips: '#FF5C7A', Chin: '#FFB020', Mandible: '#FFB020', Orbit: '#39FF14', Neck: '#7CE8FF',
  };

  // Face box: the region of the image the templates (and camera guides) assume the face occupies.
  function faceBox(view, W, H) {
    const aspect = view === 'frontal' ? 0.72 : 0.8;
    let h = H * 0.84, w = h * aspect;
    if (w > W * 0.95) { w = W * 0.95; h = w / aspect; }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }

  function seed(view, def, W, H, facing) {
    const b = faceBox(view, W, H);
    let tx = def.t[0];
    if (view === 'profile' && facing === 'left') tx = 1 - tx;
    return { x: b.x + tx * b.w, y: b.y + def.t[1] * b.h };
  }

  M.landmarks = {
    FRONTAL, PROFILE, GROUP_COLORS, faceBox, seed,
    defs: (view) => (view === 'frontal' ? FRONTAL : PROFILE),
    conns: (view) => (view === 'frontal' ? FRONTAL_CONN : PROFILE_CONN),
    color: (group) => GROUP_COLORS[group] || '#00F0FF',
    byId: (view, id) => (view === 'frontal' ? FRONTAL : PROFILE).find((d) => d.id === id),
  };
})(window.MOG = window.MOG || {});
