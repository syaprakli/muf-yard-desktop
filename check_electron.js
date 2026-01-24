const electron = require('electron');
console.log('Electron Type:', typeof electron);
console.log('Electron Value:', electron);
console.log('Is Electron Process:', 'type' in process && process.type);
console.log('Process Versions:', process.versions);
