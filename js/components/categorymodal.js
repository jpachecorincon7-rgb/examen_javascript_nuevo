import { StorageService } from '../services/storage.js';

// Evita inyección de HTML al pintar textos del usuario
const escapeHTML = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

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

    // Se invoca desde task-app: open(categoríasActuales, callback)
    // El callback recibe (categoríasActualizadas, idEliminado|null)
    open(currentCategories = [], successCallback = () => {}) {
        this.editingId = null;
        this.categories = [...currentCategories];
        this.onSuccessCallback = successCallback;
        this._opener = this.getRootNode().activeElement;

        const root = this.shadowRoot;
        root.getElementById('form-error').textContent = '';
        root.getElementById('modal-header-title').textContent = 'Gestionar Categorías';
        root.getElementById('btn-save').textContent = 'Crear categoría';
        root.getElementById('cat-name').value = '';

        this.renderCategoriesList();
        this.setBackgroundInert(true);
        root.getElementById('modal').hidden = false;
        root.getElementById('cat-name').focus();
    }

    setupFormEvents() {
        const root = this.shadowRoot;
        const modal = root.getElementById('modal');
        const errorBox = root.getElementById('form-error');

        root.getElementById('btn-close-form').addEventListener('click', () => this.hideModal());

        // Esc y clic en el fondo oscuro cierran el modal
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); this.hideModal(); }
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal();
        });

        root.getElementById('cat-name').addEventListener('input', () => {
            errorBox.textContent = '';
        });

        // Cancelar edición en curso
        root.getElementById('btn-cancel-edit').addEventListener('click', () => {
            this.editingId = null;
            root.getElementById('cat-name').value = '';
            root.getElementById('btn-save').textContent = 'Crear categoría';
            root.getElementById('btn-cancel-edit').hidden = true;
            errorBox.textContent = '';
            root.getElementById('cat-name').focus();
        });

        root.getElementById('cat-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const nameValue = root.getElementById('cat-name').value.trim();

            if (!nameValue) {
                errorBox.textContent = 'El nombre de la categoría es obligatorio.';
                root.getElementById('cat-name').focus();
                return;
            }

            // Validar duplicados (excluyendo la categoría que se está editando)
            const duplicate = this.categories.some(
                (c) => c.name.toLowerCase() === nameValue.toLowerCase() && String(c.id) !== String(this.editingId)
            );
            if (duplicate) {
                errorBox.textContent = 'Ya existe una categoría con ese nombre.';
                root.getElementById('cat-name').focus();
                return;
            }

            if (this.editingId) {
                // ACTUALIZACIÓN
                this.categories = this.categories.map((cat) =>
                    String(cat.id) === String(this.editingId) ? { ...cat, name: nameValue } : cat
                );
            } else {
                // CREACIÓN
                const newCat = {
                    id: StorageService.generateId('local'),
                    name: nameValue
                };
                this.categories = [...this.categories, newCat];
            }

            StorageService.saveCategories(this.categories);
            this.onSuccessCallback(this.categories, null);

            // Resetear formulario
            this.editingId = null;
            root.getElementById('cat-name').value = '';
            root.getElementById('btn-save').textContent = 'Crear categoría';
            root.getElementById('btn-cancel-edit').hidden = true;
            errorBox.textContent = '';
            this.renderCategoriesList();
            root.getElementById('cat-name').focus();
        });

        // Delegación de eventos para editar y eliminar categorías de la lista
        root.getElementById('cat-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-id]');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('btn-edit-cat')) {
                const cat = this.categories.find((c) => String(c.id) === id);
                if (!cat) return;
                this.editingId = id;
                root.getElementById('cat-name').value = cat.name;
                root.getElementById('btn-save').textContent = 'Guardar cambios';
                root.getElementById('btn-cancel-edit').hidden = false;
                errorBox.textContent = '';
                root.getElementById('cat-name').focus();

            } else if (btn.classList.contains('btn-del-cat')) {
                // Eliminar categoría
                this.categories = this.categories.filter((c) => String(c.id) !== id);

                // Si se estaba editando la categoría eliminada, limpiar formulario
                if (String(this.editingId) === id) {
                    this.editingId = null;
                    root.getElementById('cat-name').value = '';
                    root.getElementById('btn-save').textContent = 'Crear categoría';
                    root.getElementById('btn-cancel-edit').hidden = true;
                }

                StorageService.saveCategories(this.categories);
                // Notifica a task-app: pasa el id eliminado para que desasigne tareas
                this.onSuccessCallback(this.categories, id);
                this.renderCategoriesList();
            }
        });
    }

    hideModal() {
        this.shadowRoot.getElementById('modal').hidden = true;
        this.setBackgroundInert(false);
        const target = this._opener && this._opener.isConnected
            ? this._opener
            : this.getRootNode().getElementById('btn-categories');
        if (target && target.focus) target.focus();
    }

    setBackgroundInert(value) {
        const rootNode = this.getRootNode();
        if (rootNode.querySelectorAll) {
            rootNode.querySelectorAll('.panel, #list-container').forEach((el) => { el.inert = value; });
        }
    }

    renderCategoriesList() {
        const listEl = this.shadowRoot.getElementById('cat-list');
        if (!this.categories.length) {
            listEl.innerHTML = '<p class="empty">No hay categorías creadas aún.</p>';
            return;
        }
        listEl.innerHTML = this.categories
            .map((cat) => `
            <div class="cat-item">
                <span class="cat-name-text">${escapeHTML(cat.name)}</span>
                <div class="task-actions">
                    <button type="button" class="btn-edit-cat" data-id="${escapeHTML(cat.id)}"
                        aria-label="Editar categoría: ${escapeHTML(cat.name)}">✏️</button>
                    <button type="button" class="btn-del-cat" data-id="${escapeHTML(cat.id)}"
                        aria-label="Eliminar categoría: ${escapeHTML(cat.name)}">🗑️</button>
                </div>
            </div>`)
            .join('');
    }

    renderStructure() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="css/styles.css">

            <div class="modal" id="modal" hidden>
                <div class="modal-contenido" role="dialog" aria-modal="true" aria-labelledby="modal-header-title">
                    <h2 id="modal-header-title">Gestionar Categorías</h2>

                    <form id="cat-form" novalidate>
                        <label for="cat-name">Nombre de la categoría <span style="color:#9B3D45;">*</span></label>
                        <input type="text" id="cat-name" maxlength="40" autocomplete="off"
                               placeholder="Escribe el nombre..." aria-describedby="form-error">
                        <p class="form-error" id="form-error" role="alert"></p>

                        <div class="modal-acciones">
                            <button type="submit" id="btn-save">Crear categoría</button>
                            <button type="button" id="btn-cancel-edit" hidden>Cancelar edición</button>
                            <button type="button" id="btn-close-form">Cerrar</button>
                        </div>
                    </form>

                    <div id="cat-list" class="cat-list" aria-label="Lista de categorías" aria-live="polite"></div>
                </div>
            </div>
        `;
    }
}

customElements.define('category-modal', CategoryModal);
