import { StorageService } from '../services/storage.js';

const escapeHTML = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class CategoryModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.editingId = null;
    this.categories = [];
    this.onSuccessCallback = null;
    this._opener = null;
  }

  connectedCallback() {
    if (this._init) return;
    this._init = true;
    this.renderStructure();
    this.setupFormEvents();
  }

  open(currentCategories = [], successCallback = () => {}) {
    this.editingId = null;
    this.categories = [...currentCategories];
    this.onSuccessCallback = successCallback;
    this._opener = this.getRootNode().activeElement;

    const root = this.shadowRoot;
    root.getElementById('form-error').textContent = '';
    root.getElementById('modal-header-title').textContent = 'Gestionar Categorías';
    root.getElementById('btn-save').textContent = 'Crear categoría';
    root.getElementById('title').value = '';

    this.renderCategoriesList();
    this.setBackgroundInert(true);
    root.getElementById('modal').hidden = false;
    root.getElementById('title').focus();
  }

  setupFormEvents() {
    const root = this.shadowRoot;
    const modal = root.getElementById('modal');
    const errorBox = root.getElementById('form-error');

    root.getElementById('btn-close-form').addEventListener('click', () => this.hideModal());

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideModal();
      }
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hideModal();
    });

    root.getElementById('title').addEventListener('input', () => {
      errorBox.textContent = '';
    });

    root.getElementById('task-form').addEventListener('submit', (e) => {
      e.preventDefault();

      const nameValue = root.getElementById('title').value.trim();

      if (!nameValue) {
        errorBox.textContent = 'El nombre de la categoría es obligatorio.';
        root.getElementById('title').focus();
        return;
      }

      const duplicate = this.categories.some(
        (c) => c.name.toLowerCase() === nameValue.toLowerCase() && String(c.id) !== String(this.editingId)
      );
      if (duplicate) {
        errorBox.textContent = 'Ya existe una categoría con ese nombre.';
        root.getElementById('title').focus();
        return;
      }

      if (this.editingId) {
        this.categories = this.categories.map((cat) =>
          String(cat.id) === String(this.editingId) ? { ...cat, name: nameValue } : cat
        );
      } else {
        const newCat = {
          id: StorageService.generateId('local'),
          name: nameValue
        };
        this.categories = [...this.categories, newCat];
      }

      StorageService.saveCategories(this.categories);
      this.onSuccessCallback(this.categories, null);
      this.editingId = null;
      root.getElementById('title').value = '';
      root.getElementById('btn-save').textContent = 'Crear categoría';
      this.renderCategoriesList();
    });

    root.getElementById('cat-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const id = btn.dataset.id;

      if (btn.classList.contains('btn-edit-cat')) {
        const cat = this.categories.find((c) => String(c.id) === id);
        if (!cat) return;
        this.editingId = id;
        root.getElementById('title').value = cat.name;
        root.getElementById('btn-save').textContent = 'Guardar cambios';
        errorBox.textContent = '';
        root.getElementById('title').focus();
      } else if (btn.classList.contains('btn-del-cat')) {
        this.categories = this.categories.filter((c) => String(c.id) !== id);
        if (String(this.editingId) === id) {
          this.editingId = null;
          root.getElementById('title').value = '';
          root.getElementById('btn-save').textContent = 'Crear categoría';
        }
        StorageService.saveCategories(this.categories);
        this.onSuccessCallback(this.categories, id);
        this.renderCategoriesList();
      }
    });
  }

  hideModal() {
    this.shadowRoot.getElementById('modal').hidden = true;
    this.setBackgroundInert(false);
    const target = this._opener && this._opener.isConnected ? this._opener : this.getRootNode().getElementById('btn-categories');
    if (target && target.focus) target.focus();
  }

  setBackgroundInert(value) {
    const rootNode = this.getRootNode();
    if (rootNode.querySelectorAll) {
      rootNode.querySelectorAll('.panel, #list-container').forEach((el) => {
        el.inert = value;
      });
    }
  }

  renderCategoriesList() {
    const listEl = this.shadowRoot.getElementById('cat-list');
    if (!this.categories.length) {
      listEl.innerHTML = '<p class="empty">No hay categorías creadas aún.</p>';
      return;
    }
    listEl.innerHTML = this.categories
      .map(
        (cat) => `
        <div class="task-card" style="margin-top:8px; padding:8px 12px;">
          <span class="task-title">${escapeHTML(cat.name)}</span>
          <div class="task-actions">
            <button type="button" class="btn-edit-cat" data-id="${escapeHTML(cat.id)}">✏️</button>
            <button type="button" class="btn-del-cat" data-id="${escapeHTML(cat.id)}">🗑️</button>
          </div>
        </div>`
      )
      .join('');
  }

  renderStructure() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="css/styles.css">

      <div class="modal" id="modal" hidden>
        <div class="modal-contenido" role="dialog" aria-modal="true" aria-labelledby="modal-header-title">
          <h2 id="modal-header-title">Gestionar Categorías</h2>
          <form id="task-form" novalidate>
            <label for="title">Nombre de la categoría <span style="color:#9B3D45;">*</span></label>
            <input type="text" id="title" maxlength="40" autocomplete="off"
                   placeholder="Escribe el nombre..." aria-describedby="form-error">
            <p class="form-error" id="form-error" role="alert"></p>

            <div class="modal-acciones">
              <button type="submit" id="btn-save">Crear categoría</button>
              <button type="button" id="btn-close-form">Cerrar</button>
            </div>
          </form>
          <div id="cat-list" style="margin-top:12px; max-height:220px; overflow-y:auto;"></div>
        </div>
      </div>
    `;
  }
}

customElements.define('category-modal', CategoryModal)