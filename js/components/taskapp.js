import { StorageService } from '../services/storage.js';
import './taskmodal.js';    // Formulario de creacion/edicion
import './importmodal.js';  // Importacion desde la API
import './categorymodal.js'
// Evita inyeccion de HTML al pintar textos del usuario o de la API
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const isApi = (task) => String(task.id).startsWith('api-'); // Importadas: solo lectura

const TOAST_MS = 3200; // Tiempo que permanece visible el aviso

class TaskApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Requerimiento: Shadow DOM
        this.tasks = StorageService.getTasks();
        this.categories = StorageService.getCategories();
        this.filterStatus = 'all';
        this.searchQuery = '';
        this._ready = false;
        this._toastTimer = null;
    }

    connectedCallback() {
        if (this._ready) return; // Evita re-renderizar y duplicar listeners si se reconecta
        this._ready = true;
        this.render();
        this.setupEventListeners();
    }

    // Filtrado y busqueda en tiempo real (busca en titulo y descripcion)
    get filteredTasks() {
        const q = this.searchQuery.trim().toLowerCase();
        return this.tasks.filter((task) => {
            const inTitle = String(task.title ?? '').toLowerCase().includes(q);
            const inDesc = String(task.description ?? '').toLowerCase().includes(q);
            const matchesSearch = inTitle || inDesc;
            const matchesFilter = this.filterStatus === 'all' ? true
                : this.filterStatus === 'completed' ? task.completed : !task.completed;
            return matchesSearch && matchesFilter;
        });
    }

    setupEventListeners() {
        const root = this.shadowRoot;

        root.getElementById('search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.updateListUI();
        });

        root.getElementById('filter').addEventListener('change', (e) => {
            this.filterStatus = e.target.value;
            this.updateListUI();
        });

        // Vaciar toda la lista
        root.getElementById('btn-clear').addEventListener('click', async () => {
            if (!this.tasks.length) {
                this.showToast('No hay tareas para vaciar.', 'info');
                return;
            }
            const confirmed = await this.confirmAction({
                title: 'Vaciar lista',
                message: 'Se eliminarán todas las tareas, incluidas las importadas. Esta acción no se puede deshacer.',
                acceptLabel: 'Vaciar lista'
            });
            if (!confirmed) return;

            this.tasks = [];
            if (this.saveAndRefresh()) this.showToast('Lista vaciada.');
        });

        // Marcar como terminadas (las importadas son de solo lectura y se omiten)
        root.getElementById('btn-complete-all').addEventListener('click', () => {
            const pending = this.tasks.filter((task) => !isApi(task) && !task.completed).length;
            if (!pending) {
                this.showToast('No hay tareas pendientes para marcar.', 'info');
                return;
            }
            this.tasks = this.tasks.map((task) => (isApi(task) ? task : { ...task, completed: true }));
            if (this.saveAndRefresh()) this.showToast(`Tareas marcadas como terminadas: ${pending}.`);
        });

        root.getElementById('btn-import').addEventListener('click', () => this.openImportModalView());
        root.getElementById('btn-create').addEventListener('click', () => this.openFormModalView());
        root.getElementById('btn-categories').addEventListener('click', ()=>this.opencategorymoadalview());
        // Delegacion de eventos para checkbox, editar y eliminar
        root.getElementById('list-container').addEventListener('click', async (e) => {
            const el = e.target.closest('[data-id]');
            if (!el) return;
            const id = el.dataset.id;
            const task = this.tasks.find((t) => String(t.id) === id);
            if (!task) return;

            if (el.classList.contains('task-check')) {
                if (isApi(task)) return; // Importadas: no se actualizan
                task.completed = el.checked;
                this.saveAndRefresh();
            } else if (el.classList.contains('btn-delete')) {
                const confirmed = await this.confirmAction({
                    title: 'Eliminar tarea',
                    message: `¿Seguro que quieres eliminar la tarea "${task.title}"?`,
                    acceptLabel: 'Eliminar'
                });
                if (!confirmed) return;

                this.tasks = this.tasks.filter((t) => String(t.id) !== id);
                if (this.saveAndRefresh()) this.showToast('Tarea eliminada.');
            } else if (el.classList.contains('btn-edit')) {
                if (isApi(task)) return; // Importadas: solo eliminar
                this.openFormModalView(id);
            }
        });
    }

    openImportModalView() {
        let importElement = this.shadowRoot.querySelector('import-modal');
        if (!importElement) {
            importElement = document.createElement('import-modal');
            this.shadowRoot.appendChild(importElement);
        }
        importElement.open(this.tasks, (synchronizedArray) => {
            const added = synchronizedArray.length - this.tasks.length;
            this.tasks = synchronizedArray;
            if (this.saveAndRefresh()) {
                this.showToast(added === 1 ? '1 tarea importada.' : `${added} tareas importadas.`);
            }
        });
    }

    openFormModalView(id = null) {
        let formElement = this.shadowRoot.querySelector('task-modal');
        if (!formElement) {
            formElement = document.createElement('task-modal');
            this.shadowRoot.appendChild(formElement);
        }
        formElement.open(id, this.tasks, (updatedArray) => {
            const wasCreated = updatedArray.length > this.tasks.length;
            this.tasks = updatedArray;
            if (this.saveAndRefresh()) {
                this.showToast(wasCreated ? 'Tarea creada.' : 'Tarea actualizada.');
            }
        });
    }
    opencategorymodalview() {
        let catElement = this.shadowRoot.querySelector('category-modal');
        if (!catElement) {
            catElement =document.createElement('category-modal');
            this.shadowRoot.appendChild(catElement);
        }
        catElement.open(this.categories, (updatedcategories, deletedcategoryid) => {
            this.categories = updatedcategories;
            if (deletedcategoryid) {
                this.task = this.task.map((t) =>
                    String(t.categoryid) === String(deletedcategoryid) ? { ...t,categoryid: null} : t
            );
            StorageService.saveTasks(this.task);
            this.updateListUI();
    }});  
               
    }


    // Guarda en localStorage y redibuja
    saveAndRefresh() {
        const saved = StorageService.saveTasks(this.tasks);
        this.updateListUI();
        if (!saved) this.showToast('No se pudieron guardar los cambios en el navegador.', 'error');
        return saved;
    }

    // ===== Avisos breves (toast) =====
    showToast(message, type = 'success') {
        const toast = this.shadowRoot.getElementById('toast');
        clearTimeout(this._toastTimer);
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, TOAST_MS);
    }

    // ===== Confirmacion propia =====
    confirmAction({ title, message, acceptLabel }) {
        const root = this.shadowRoot;
        const modal = root.getElementById('confirm-modal');
        const acceptBtn = root.getElementById('confirm-accept');
        const cancelBtn = root.getElementById('confirm-cancel');
        const opener = root.activeElement;

        root.getElementById('confirm-title').textContent = title;
        root.getElementById('confirm-message').textContent = message;
        acceptBtn.textContent = acceptLabel;

        this.setBackgroundInert(true);
        modal.hidden = false;
        cancelBtn.focus();

        return new Promise((resolve) => {
            const finish = (result) => {
                modal.hidden = true;
                this.setBackgroundInert(false);
                acceptBtn.removeEventListener('click', onAccept);
                cancelBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onBackdrop);
                modal.removeEventListener('keydown', onKey);
                const target = opener && opener.isConnected ? opener : root.getElementById('btn-create');
                if (target && target.focus) target.focus();
                resolve(result);
            };
            const onAccept = () => finish(true);
            const onCancel = () => finish(false);
            const onBackdrop = (e) => { if (e.target === modal) finish(false); };
            const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } };

            acceptBtn.addEventListener('click', onAccept);
            cancelBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onBackdrop);
            modal.addEventListener('keydown', onKey);
        });
    }

    setBackgroundInert(value) {
        this.shadowRoot.querySelectorAll('.panel, #list-container').forEach((el) => { el.inert = value; });
    }

    updateSummary() {
        const total = this.tasks.length;
        const done = this.tasks.filter((t) => t.completed).length;
        this.shadowRoot.getElementById('summary').textContent =
            `Total: ${total} · Pendientes: ${total - done} · Completadas: ${done}`;
    }

    updateListUI() {
        this.updateSummary();
        const container = this.shadowRoot.getElementById('list-container');
        const list = this.filteredTasks;

        if (!list.length) {
            container.innerHTML = `<p class="empty">${this.tasks.length
                ? 'Ninguna tarea coincide con tu búsqueda o filtro.'
                : 'Aún no tienes tareas. Crea una nueva o importa algunas del banco de tareas.'}</p>`;
            return;
        }

        container.innerHTML = list.map((task) => {
            const api = isApi(task);
            const title = escapeHTML(task.title);
            const description = task.description ? escapeHTML(task.description) : '';
            const id = escapeHTML(task.id);
            const categoryObj = this.categories.find((C) => String(C.id)===String(task.categoryid));
            const categoryName = categoryObj ? escapeHTML(categoryObj.name) : '';
            return `
            <div class="task-card ${task.completed ? 'completed' : ''}">
                <div class="task-left">
                    <input type="checkbox" class="task-check" data-id="${id}"
                        aria-label="Completada: ${title}"
                        ${task.completed ? 'checked' : ''} ${api ? 'disabled' : ''}>
                    <div class="task-data">
                        <p class="task-title">${title}</p>
                        ${description ? `<p class="task-desc">${description}</p>` : ''}
                        ${categoryName ? <span class= "tag tag-local">📋 ${categoryName}</span> : ''}
                        <small class="task-date">Registrada: ${escapeHTML(task.date || 'Sin fecha')}</small>
                        <span class="tag ${api ? 'tag-api' : 'tag-local'}">${api ? '(Tarea Importada No Modificable)' : 'Tarea Creada'}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-edit" data-id="${id}" aria-label="Editar: ${title}"
                        ${api ? 'disabled' : ''}>✏️</button>
                    <button class="btn-delete" data-id="${id}" aria-label="Eliminar: ${title}">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="css/styles.css">

            <div class="panel">
                <h2>📋 Panel de Control de Tareas</h2>
                <p id="summary" class="summary" aria-live="polite"></p>
                <div class="search-bar">
                    <input type="search" id="search" placeholder="🔎 Buscar tareas por título o descripción..." aria-label="Buscar tareas" autocomplete="off">
                    <select id="filter" aria-label="Filtrar por estado">
                        <option value="all">Todos los estados</option>
                        <option value="pending">Pendientes</option>
                        <option value="completed">Completadas</option>
                    </select>
                </div>
                <div class="btn-group">
                    <button id="btn-create">➕ Crear Tarea</button>
                    <button id="btn-import" class="btn-import">📥 Importar Tareas</button>
                    <button id="btn-complete-all" class="btn-complete">✔️ Marcar Terminadas</button>
                    <button id="btn-clear" class="btn-danger">🗑️ Vaciar Lista</button>
                    <button id="btn-categories">📋categorias</button>
                </div>
            </div>

            <div id="list-container" aria-live="polite"></div>

            <div id="toast" class="toast" role="status" aria-live="polite"></div>

            <div class="modal" id="confirm-modal" hidden>
                <div class="modal-contenido modal-confirm" role="alertdialog" aria-modal="true"
                    aria-labelledby="confirm-title" aria-describedby="confirm-message">
                    <h2 id="confirm-title">Confirmar acción</h2>
                    <p id="confirm-message" class="confirm-mensaje"></p>
                    <div class="modal-acciones">
                        <button type="button" id="confirm-accept" class="btn-danger">Aceptar</button>
                        <button type="button" id="confirm-cancel">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
        this.updateListUI();
    }
}

customElements.define('task-app', TaskApp);
