// --- State & Config ---
let notes = [];
let activeNote = null;
let syncConfig = {
  enabled: false,
  serverUrl: '',
  apiKey: ''
};
let syncIntervalId = null;
let html5QrCodeScanner = null;
let deletedNotesPendingSync = [];

// Palette de couleurs disponibles
const COLORS = [
  '#fff59d', // Jaune
  '#a5d6a7', // Vert
  '#90caf9', // Bleu
  '#f48fb1', // Rose
  '#ce93d8', // Violet
  '#ffcc80'  // Orange
];

// --- Initialisation ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadLocalData();
  checkAccessRequirement();
  setupUIEventListeners();
  generateColorSelector();
  
  // Cacher le splash screen après 1 seconde
  setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    splash.classList.add('fade-out');
  }, 1000);

  // Lancer la première synchronisation et le timer
  initSync();
  renderNotes();
});

// --- Gestion des données locales ---
function loadLocalData() {
  // Charger les notes
  const localNotes = localStorage.getItem('tux_it_notes');
  if (localNotes) {
    try {
      notes = JSON.parse(localNotes);
    } catch (e) {
      console.error("Erreur de parsing des notes locales", e);
      notes = [];
    }
  }

  // Charger la config de synchro
  const localConfig = localStorage.getItem('tux_it_sync_config');
  if (localConfig) {
    try {
      syncConfig = JSON.parse(localConfig);
    } catch (e) {
      console.error("Erreur de parsing de la config de synchro", e);
    }
  }

}

function saveLocalNotes() {
  localStorage.setItem('tux_it_notes', JSON.stringify(notes));
}

function saveSyncConfig() {
  localStorage.setItem('tux_it_sync_config', JSON.stringify(syncConfig));
}

// --- Rendu de l'Interface ---
function renderNotes() {
  const grid = document.getElementById('notesGrid');
  const emptyState = document.getElementById('emptyState');
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
  
  grid.innerHTML = '';
  
  // Filtrer les notes actives (non supprimées)
  let filtered = notes.filter(n => !n.trashed);
  
  // Appliquer le filtre de recherche si saisi
  if (searchQuery) {
    filtered = filtered.filter(n => {
      const contentText = getPlainText(n.content).toLowerCase();
      return contentText.includes(searchQuery);
    });
  }
  
  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    grid.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    grid.style.display = 'grid';
    
    // Trier par date de modification décroissante
    filtered.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    
    filtered.forEach(note => {
      const card = createNoteCard(note);
      grid.appendChild(card);
    });
  }
}

function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.style.backgroundColor = note.color || '#fff59d';
  card.dataset.id = note.id;
  
  const text = getPlainText(note.content);
  const title = getNoteTitle(text) || 'Sans titre';
  const preview = getNotePreview(text, title);
  const dateStr = formatDate(note.lastModified);
  
  card.innerHTML = `
    <h4 class="note-card-title">${escapeHtml(title)}</h4>
    <p class="note-card-preview">${escapeHtml(preview)}</p>
    <div class="note-card-footer">
      <span>${dateStr}</span>
      ${note.synced === false ? `
        <svg class="note-card-sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.04-1.29-2.15-2.5-2.5-3.02-.89-6.13 1.15-6.5 4.5A4.5 4.5 0 0 0 7.5 22h10z"/>
        </svg>
      ` : ''}
    </div>
  `;
  
  card.addEventListener('click', () => openEditor(note));
  return card;
}

// --- Événements UI ---
function setupUIEventListeners() {
  // Recherche
  document.getElementById('searchInput').addEventListener('input', renderNotes);
  
  // Bouton flottant (Nouvelle note)
  document.getElementById('fabNewNote').addEventListener('click', createNewNote);
  
  // Boutons de fermeture
  document.getElementById('editorCloseBtn').addEventListener('click', closeEditor);
  document.getElementById('settingsCloseBtn').addEventListener('click', closeSettings);
  
  // Bouton de sauvegarde de l'éditeur
  document.getElementById('editorSaveBtn').addEventListener('click', saveActiveNote);

  // Bouton de formatage gras
  const boldBtn = document.getElementById('boldBtn');
  if (boldBtn) {
    boldBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand('bold', false, null);
    });
  }
  
  // Bouton de suppression de l'éditeur
  document.getElementById('editorDeleteBtn').addEventListener('click', deleteActiveNote);
  
  // Bouton des paramètres
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  
  // Formulaire des paramètres
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
  
  // Toggle de synchro
  document.getElementById('syncEnable').addEventListener('change', (e) => {
    const fields = document.getElementById('syncFields');
    if (e.target.checked) {
      fields.classList.add('visible');
    } else {
      fields.classList.remove('visible');
    }
  });

  // Forcer la synchro au clic sur le nuage
  document.getElementById('syncStatusBtn').addEventListener('click', () => {
    if (syncConfig.enabled) {
      updateSyncStatus('progress');
      triggerSync();
    } else {
      openSettings();
    }
  });

  // Scanner QR Code
  document.getElementById('startQrScanBtn').addEventListener('click', startQrScan);
  document.getElementById('stopQrScanBtn').addEventListener('click', stopQrScan);

  // Changement de thème
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
}

function generateColorSelector() {
  const container = document.getElementById('colorSelector');
  container.innerHTML = '';
  
  COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.style.backgroundColor = color;
    btn.dataset.color = color;
    
    // Définir la couleur et sa variante plus sombre pour le ring
    btn.style.setProperty('--btn-color', color);
    btn.style.setProperty('--dark-color', darkenColor(color, 25)); // 25% plus sombre
    
    btn.addEventListener('click', () => selectEditorColor(color));
    container.appendChild(btn);
  });
}

// --- Logique de l'Éditeur ---
function openEditor(note) {
  activeNote = { ...note };
  const modal = document.getElementById('editorModal');
  const textarea = document.getElementById('noteTextarea');
  const sheet = modal.querySelector('.bottom-sheet');
  
  textarea.innerHTML = getEditableHtml(activeNote.content);
  sheet.style.backgroundColor = activeNote.color;
  
  // Activer la couleur sélectionnée dans la palette
  updatePaletteSelection(activeNote.color);
  
  modal.classList.add('active');
}

function closeEditor() {
  document.getElementById('editorModal').classList.remove('active');
  activeNote = null;
}

function selectEditorColor(color) {
  if (activeNote) {
    activeNote.color = color;
    const modal = document.getElementById('editorModal');
    modal.querySelector('.bottom-sheet').style.backgroundColor = color;
    updatePaletteSelection(color);
  }
}

function updatePaletteSelection(selectedColor) {
  const buttons = document.querySelectorAll('.color-btn');
  buttons.forEach(btn => {
    if (btn.dataset.color.toLowerCase() === selectedColor.toLowerCase()) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function createNewNote() {
  const newNote = {
    id: generateUuid(),
    content: "",
    x: 100,
    y: 100,
    width: 250,
    height: 250,
    color: COLORS[0], // Jaune par défaut
    alwaysOnTop: false,
    opacity: 1.0,
    locked: false,
    favorite: false,
    archived: false,
    trashed: false,
    lastModified: new Date().toISOString(),
    created: new Date().toISOString(),
    tags: [],
    synced: false
  };
  
  openEditor(newNote);
}

function saveActiveNote() {
  if (!activeNote) return;
  
  const textarea = document.getElementById('noteTextarea');
  const htmlContent = textarea.innerHTML;
  const textContent = textarea.innerText.trim();
  
  activeNote.content = textContent === "" ? "" : htmlContent;
  activeNote.lastModified = new Date().toISOString();
  activeNote.synced = false;
  
  const index = notes.findIndex(n => n.id === activeNote.id);
  if (index !== -1) {
    notes[index] = activeNote;
  } else {
    notes.push(activeNote);
  }
  
  saveLocalNotes();
  renderNotes();
  closeEditor();
  
  if (syncConfig.enabled) {
    triggerSync();
  }
}

function deleteActiveNote() {
  if (!activeNote) return;
  
  if (confirm("Voulez-vous vraiment supprimer cette note ?")) {
    const index = notes.findIndex(n => n.id === activeNote.id);
    if (index !== -1) {
      // Enregistrer la suppression pour la propager lors de la prochaine synchro
      if (!deletedNotesPendingSync.includes(activeNote.id)) {
        deletedNotesPendingSync.push(activeNote.id);
      }

      // Pour une suppression simple et synchro, on retire de la liste
      notes.splice(index, 1);
      saveLocalNotes();
      renderNotes();
      closeEditor();
      
      if (syncConfig.enabled) {
        triggerSync();
      }
    }
  }
}

// --- Paramètres ---
function openSettings() {
  document.getElementById('syncEnable').checked = true;
  document.getElementById('serverUrl').value = syncConfig.serverUrl || '';
  document.getElementById('apiKey').value = syncConfig.apiKey || '';
  
  const fields = document.getElementById('syncFields');
  fields.classList.add('visible');
  
  // Mettre à jour les diagnostics
  updateDiagnostics();
  
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
  if (document.body.classList.contains('needs-activation')) {
    return;
  }
  stopQrScan();
  document.getElementById('settingsModal').classList.remove('active');
}

function handleSettingsSubmit(e) {
  e.preventDefault();
  
  const url = document.getElementById('serverUrl').value.trim();
  const key = document.getElementById('apiKey').value.trim();
  
  if (!url || !key) {
    alert("Veuillez renseigner l'URL du serveur et la clé d'API.");
    return;
  }
  
  validateAndSaveConfig(url, key);
}

function updateDiagnostics() {
  const statusEl = document.getElementById('diagStatus');
  const lastTimeEl = document.getElementById('diagLastTime');
  const jsVerEl = document.getElementById('jsVersion');
  if (jsVerEl) {
    jsVerEl.textContent = 'v27';
  }
  
  const lastSync = localStorage.getItem('tux_it_last_sync_time');
  lastTimeEl.innerText = lastSync ? formatDate(lastSync) + ' ' + new Date(lastSync).toLocaleTimeString() : 'Jamais';
  
  if (!syncConfig.enabled) {
    statusEl.innerText = 'Désactivé';
    statusEl.style.color = 'var(--text-secondary)';
  } else {
    const lastResult = localStorage.getItem('tux_it_last_sync_result');
    if (lastResult === 'success') {
      statusEl.innerText = 'Connecté (OK)';
      statusEl.style.color = '#4caf50';
    } else if (lastResult === 'error') {
      statusEl.innerText = 'Erreur de connexion';
      statusEl.style.color = '#f44336';
    } else {
      statusEl.innerText = 'En attente...';
      statusEl.style.color = '#ff9800';
    }
  }
}

// --- Synchronisation avec le Serveur Go ---
function initSync() {
  // Arrêter le timer précédent
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  
  if (syncConfig.enabled && syncConfig.serverUrl && syncConfig.apiKey) {
    updateSyncStatus('offline'); // Initialisé mais pas encore connecté
    
    // Déclencher une synchro
    triggerSync();
    
    // Configurer le timer de synchronisation toutes les 15 secondes
    syncIntervalId = setInterval(triggerSync, 15000);
  } else {
    updateSyncStatus('offline');
  }
}

function updateSyncStatus(status) {
  const btn = document.getElementById('syncStatusBtn');
  btn.className = 'icon-btn'; // Reset
  
  switch (status) {
    case 'online':
      btn.classList.add('sync-online');
      break;
    case 'progress':
      btn.classList.add('sync-progress');
      break;
    case 'error':
      btn.classList.add('sync-error');
      break;
    case 'offline':
    default:
      btn.classList.add('sync-offline');
      break;
  }
}

function triggerSync() {
  if (!syncConfig.enabled || !syncConfig.serverUrl || !syncConfig.apiKey) {
    updateSyncStatus('offline');
    return;
  }
  
  updateSyncStatus('progress');
  
  const headers = {
    'Authorization': `Bearer ${syncConfig.apiKey}`,
    'Content-Type': 'application/json'
  };
  
  // 1. Récupérer les notes distantes (GET)
  fetch(`${syncConfig.serverUrl}/notes`, { headers })
    .then(response => {
      if (!response.ok) throw new Error("Accès refusé ou serveur indisponible");
      return response.json();
    })
    .then(remoteNotes => {
      // 1.5 Filtrer les notes distantes pour retirer celles qui ont été supprimées localement et sont en attente de synchro
      const filteredRemote = remoteNotes.filter(rNote => !deletedNotesPendingSync.includes(rNote.id));

      // 2. Fusionner les notes locales et distantes filtrées
      const merged = mergeNotes(notes, filteredRemote);
      
      // Indiquer si les notes locales ont changé après fusion
      let hasLocalChanges = false;
      if (merged.length !== notes.length) {
        hasLocalChanges = true;
      } else {
        for (let i = 0; i < notes.length; i++) {
          // Comparaison basique (id et lastModified)
          const m = merged.find(n => n.id === notes[i].id);
          if (!m || m.lastModified !== notes[i].lastModified) {
            hasLocalChanges = true;
            break;
          }
        }
      }
      
      // Marquer toutes les notes fusionnées comme synchronisées localement
      const syncedNotes = merged.map(n => ({ ...n, synced: true }));
      
      notes = syncedNotes;
      saveLocalNotes();
      
      if (hasLocalChanges) {
        renderNotes();
      }
      
      // Détecter s'il y a des changements locaux à pousser vers le serveur (par rapport à remoteNotes)
      let hasChangesToPush = false;
      if (merged.length !== remoteNotes.length) {
        hasChangesToPush = true;
      } else {
        for (const mNote of merged) {
          const rNote = remoteNotes.find(r => r.id === mNote.id);
          if (!rNote || 
              rNote.content !== mNote.content || 
              rNote.color !== mNote.color || 
              rNote.lastModified !== mNote.lastModified || 
              rNote.archived !== mNote.archived || 
              rNote.trashed !== mNote.trashed || 
              rNote.alwaysOnTop !== mNote.alwaysOnTop ||
              rNote.locked !== mNote.locked ||
              rNote.favorite !== mNote.favorite ||
              rNote.opacity !== mNote.opacity ||
              rNote.x !== mNote.x ||
              rNote.y !== mNote.y ||
              rNote.width !== mNote.width ||
              rNote.height !== mNote.height ||
              mNote.synced === false) {
            hasChangesToPush = true;
            break;
          }
        }
      }
      
      // 3. Pousser le tableau fusionné sur le serveur (POST) uniquement s'il y a des changements
      if (hasChangesToPush) {
        return fetch(`${syncConfig.serverUrl}/notes`, {
          method: 'POST',
          headers,
          body: JSON.stringify(syncedNotes)
        }).then(response => {
          if (!response.ok) throw new Error("Erreur lors de l'envoi des données");
          deletedNotesPendingSync = []; // Vider après succès de propagation
          updateSyncStatus('online');
          localStorage.setItem('tux_it_last_sync_time', new Date().toISOString());
          localStorage.setItem('tux_it_last_sync_result', 'success');
          updateDiagnostics();
        });
      } else {
        // Pas de changements à pousser, synchro terminée avec succès
        deletedNotesPendingSync = []; // Vider car résolu
        updateSyncStatus('online');
        localStorage.setItem('tux_it_last_sync_time', new Date().toISOString());
        localStorage.setItem('tux_it_last_sync_result', 'success');
        updateDiagnostics();
      }
    })
    .catch(err => {
      console.error("Erreur de synchronisation", err);
      updateSyncStatus('error');
      localStorage.setItem('tux_it_last_sync_result', 'error');
      updateDiagnostics();
    });
}

// Algorithme de fusion de notes (Le plus récent l'emporte)
function mergeNotes(local, remote) {
  const mergedMap = new Map();
  
  // Remplir avec les notes distantes
  remote.forEach(n => {
    mergedMap.set(n.id, n);
  });
  
  // Fusionner avec les locales
  local.forEach(l => {
    const r = mergedMap.get(l.id);
    if (!r) {
      // Note uniquement locale
      // Si elle a déjà été synchronisée (l.synced !== false), cela signifie qu'elle a été supprimée sur un autre poste.
      // Sinon, c'est une nouvelle note locale créée hors-ligne.
      if (l.synced === false) {
        mergedMap.set(l.id, l);
      }
    } else {
      // Comparer les timestamps
      const lDate = new Date(l.lastModified);
      const rDate = new Date(r.lastModified);
      if (lDate > rDate) {
        mergedMap.set(l.id, l); // La locale est plus récente
      }
    }
  });
  
  return Array.from(mergedMap.values());
}

// --- Utilitaires ---
function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getPlainText(htmlContent) {
  if (!htmlContent) return '';
  // Remplacement basique du HTML (Qt6 C++ envoie du Rich Text). Si texte brut, retourne tel quel.
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;
  return temp.textContent || temp.innerText || '';
}

function getEditableHtml(htmlContent) {
  if (!htmlContent) return '';
  // Si c'est du texte brut sans balises d'édition complexes, on remplace les sauts de ligne par des <br>
  if (!htmlContent.includes('<html') && !htmlContent.includes('<body') && !htmlContent.includes('<p') && !htmlContent.includes('<span') && !htmlContent.includes('<div')) {
    return htmlContent.replace(/\n/g, '<br>');
  }
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    return doc.body.innerHTML || htmlContent;
  } catch (e) {
    console.error("Erreur de parsing HTML", e);
    return htmlContent;
  }
}

function darkenColor(hex, percent) {
  let num = parseInt(hex.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) - amt,
      G = (num >> 8 & 0x00FF) - amt,
      B = (num & 0x0000FF) - amt;
  
  R = R < 0 ? 0 : R > 255 ? 255 : R;
  G = G < 0 ? 0 : G > 255 ? 255 : G;
  B = B < 0 ? 0 : B > 255 ? 255 : B;
  
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function getNoteTitle(text) {
  if (!text) return '';
  const lines = text.split('\n');
  return lines[0].trim();
}

function getNotePreview(text, title) {
  if (!text) return '';
  // Retourner le texte restant après le titre
  let preview = text.substring(title.length).trim();
  return preview || '';
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function escapeHtml(string) {
  if (!string) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return string.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// --- Logique du Scanner de QR Code ---
function startQrScan() {
  const container = document.getElementById('qrReaderContainer');
  container.style.display = 'block';
  
  if (html5QrCodeScanner) {
    stopQrScan();
  }
  
  html5QrCodeScanner = new Html5Qrcode("qrReader");
  
  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    try {
      let url = "";
      let key = "";
      
      if (decodedText.startsWith('{')) {
        const data = JSON.parse(decodedText);
        url = data.url;
        key = data.key;
      } else if (decodedText.includes('|')) {
        const parts = decodedText.split('|');
        url = parts[0];
        key = parts[1];
      } else {
        throw new Error("Format de QR Code inconnu");
      }
      
      if (!url || !key) {
        throw new Error("Contenu incomplet dans le QR Code");
      }
      
      // Normaliser l'URL
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      
      // Mettre à jour l'UI
      document.getElementById('serverUrl').value = url;
      document.getElementById('apiKey').value = key;
      
      validateAndSaveConfig(url, key).then(success => {
        if (success) {
          stopQrScan();
        }
      });
    } catch (e) {
      console.error(e);
      alert("QR Code de synchronisation invalide.");
    }
  };
  
  const qrCodeErrorCallback = (errorMessage) => {
    // Les erreurs de scan continu sont normales et peuvent être ignorées (ex: pas de QR code dans le champ de vision)
  };
  
  const config = { fps: 10, qrbox: { width: 220, height: 220 } };
  
  html5QrCodeScanner.start(
    { facingMode: "environment" },
    config,
    qrCodeSuccessCallback,
    qrCodeErrorCallback
  ).catch(err => {
    console.error("Impossible de démarrer le scan", err);
    alert("Erreur de caméra : Veuillez autoriser l'accès à la caméra pour scanner.");
    stopQrScan();
  });
}

function stopQrScan() {
  const container = document.getElementById('qrReaderContainer');
  container.style.display = 'none';
  
  if (html5QrCodeScanner) {
    if (html5QrCodeScanner.isScanning) {
      html5QrCodeScanner.stop().then(() => {
        html5QrCodeScanner.clear();
        html5QrCodeScanner = null;
      }).catch(err => {
        console.error("Erreur d'arrêt du scan", err);
        html5QrCodeScanner = null;
      });
    } else {
      html5QrCodeScanner.clear();
      html5QrCodeScanner = null;
    }
  }
}

// --- Gestion du Thème (Light / Dark) ---
function initTheme() {
  const savedTheme = localStorage.getItem('tux_it_theme') || 'dark';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  const body = document.body;
  const sunIcon = document.querySelector('#themeToggleBtn .sun-icon');
  const moonIcon = document.querySelector('#themeToggleBtn .moon-icon');
  
  if (theme === 'light') {
    body.classList.add('light-theme');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  } else {
    body.classList.remove('light-theme');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }
}

function toggleTheme() {
  const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('tux_it_theme', newTheme);
  applyTheme(newTheme);
}

// --- Sécurité et Validation de la Clé d'API ---
function checkAccessRequirement() {
  if (!syncConfig.apiKey || !syncConfig.serverUrl) {
    document.body.classList.add('needs-activation');
    openSettings();
  } else {
    document.body.classList.remove('needs-activation');
  }
}

async function validateAndSaveConfig(url, key) {
  // Normaliser l'URL (retirer le slash de fin)
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  const statusEl = document.getElementById('diagStatus');
  if (statusEl) {
    statusEl.innerText = "Validation en cours...";
    statusEl.style.color = "var(--text-secondary)";
  }
  
  try {
    const response = await fetch(`${url}/notes`, {
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });
    
    if (!response.ok) {
      throw new Error("Accès refusé ou serveur indisponible (statut : " + response.status + ")");
    }
    
    // Si OK, on sauvegarde la config
    syncConfig.enabled = true;
    syncConfig.serverUrl = url;
    syncConfig.apiKey = key;
    
    saveSyncConfig();
    
    // Retirer le lock
    document.body.classList.remove('needs-activation');
    
    // Fermer la modale (closeSettings vérifie la présence de needs-activation, qu'on vient d'enlever)
    document.body.classList.remove('needs-activation'); // just to be sure
    stopQrScan();
    document.getElementById('settingsModal').classList.remove('active');
    
    // Lancer la synchro complète
    initSync();
    
    alert("Configuration validée ! Bienvenue sur Tux-It.");
    return true;
  } catch (error) {
    console.error("Erreur de validation de la synchro:", error);
    alert("Échec de la validation : " + error.message);
    
    if (statusEl) {
      statusEl.innerText = "Validation échouée";
      statusEl.style.color = "#f44336";
    }
    return false;
  }
}
