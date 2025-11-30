// Ported from public/modules/threats.module.js

export function calculateBlastZones(yieldKg = 1.0) {
  // Cubic root scaling law: R_new = R_ref * (W_new / W_ref)^(1/3)
  // Reference: 1kg TNT
  const scaleFactor = Math.pow(yieldKg, 1/3);

  return [
    {
      name: 'Lethal Zone',
      radius: 10 * scaleFactor, // 10m for 1kg
      color: '#FF0000', // Red
      opacity: 0.4
    },
    {
      name: 'Severe Damage',
      radius: 30 * scaleFactor, // 30m for 1kg
      color: '#FF4500', // OrangeRed
      opacity: 0.3
    },
    {
      name: 'Moderate Damage',
      radius: 60 * scaleFactor, // 60m for 1kg
      color: '#FFA500', // Orange
      opacity: 0.2
    },
    {
      name: 'Minor Damage',
      radius: 100 * scaleFactor, // 100m for 1kg
      color: '#FFFF00', // Yellow
      opacity: 0.1
    }
  ];
}
