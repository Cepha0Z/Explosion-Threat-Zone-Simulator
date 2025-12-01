// Quick diagnostic script - paste this in browser console

console.log('=== SIMULATION MODULE DIAGNOSTIC ===');
console.log('SimulationModule exists:', !!window.SimulationModule);
console.log('SimulationModule.initialize exists:', !!window.SimulationModule?.initialize);
console.log('SimulationModule.ensureButtonsCreated exists:', !!window.SimulationModule?.ensureButtonsCreated);

const accidentsContainer = document.getElementById('accidents-container');
const weaponsContainer = document.getElementById('weapons-container');

console.log('accidents-container exists:', !!accidentsContainer);
console.log('weapons-container exists:', !!weaponsContainer);

if (accidentsContainer) {
  console.log('accidents-container children:', accidentsContainer.children.length);
  console.log('accidents-container innerHTML length:', accidentsContainer.innerHTML.length);
}

if (weaponsContainer) {
  console.log('weapons-container children:', weaponsContainer.children.length);
  console.log('weapons-container innerHTML length:', weaponsContainer.innerHTML.length);
}

// Try to manually create buttons
if (window.SimulationModule) {
  console.log('Attempting to create buttons...');
  const result = window.SimulationModule.ensureButtonsCreated();
  console.log('Result:', result);
}
