try {
    const pdf = require('pdf-parse');
    console.log('Type of exports:', typeof pdf);
    console.log('Is function?', typeof pdf === 'function');
    console.log('Keys:', Object.keys(pdf));
    if (typeof pdf === 'object') {
        console.log('inspect:', require('util').inspect(pdf));
    }
} catch (e) {
    console.error('Require failed:', e.message);
}
