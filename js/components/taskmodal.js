import { StorageService } from '../services/storage.js';

class TaskModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Requerimiento: Shadow DOM
        this.taskId = null;
        this.tasks = [];
        this.onSuccessCallback = null;
        this._opener = null;
    }

    // Se construye una sola vez (asi la hoja de estilos ya esta cargada cuando se abre)
    connectedCallback() {
        if (this._init) return;
        this._init = true;
        this.renderStructure();
        this.setupFormEvents();
    }

    // Se invoca desde task-app: open(id|null, arregloDeTareas, callback)
    open(id = null, currentTasks = [], successCallback = () => {}) {
        if (id && String(id).startsWith('api-')) return; // Las importadas no se editan

        this.taskId = id;
        this.tasks = [...currentTasks]; // Copia: nunca se muta el arreglo de TaskApp
        this.onSuccessCallback = successCallback;
        this._opener = this.getRootNode().activeElement; // Para devolver el foco al cerrar

        const root = this.shadowRoot;
        const editing = id ? this.tasks.find((t) => String(t.id) === String(id)) : null;
        const categories = StorageService.getCategories();
        const categoryselect = root.getElementById('category');
        categoryselect.innerHTML =
          '<option value="">sin categoria</option>' +
          categories
          .map((cat) => <option value="${this.escapeHTML(cat.id)}">${this.escapeHTML(cat.name)}</option>)
          .join('');
        root.getElementById('form-error').textContent = '';
        root.getElementById('modal-header-title').textContent = editing ? 'Editar tarea' : 'Nueva tarea';
        root.getElementById('btn-save').textContent = editing ? 'Guardar cambios' : 'Guardar tarea';
        root.getElementById('title').value = editing ? editing.title : '';
        root.getElementById('description').value = editing ? (editing.description || '') : '';
        root.getElementById('date').value = (editing && editing.date) || this.todayLocal();
        root.getElementById('completed').checked = editing ? !!editing.completed : false;

        this.setBackgroundInert(true);
        root.getElementById('modal').hidden = false;
        root.getElementById('title').focus();
    }

    setupFormEvents() {
        const root = this.shadowRoot;
        const modal = root.getElementById('modal');
        const errorBox = root.getElementById('form-error');

        root.getElementById('btn-close-form').addEventListener('click', () => this.hideModal());

        // Esc cierra y clic en el fondo oscuro tambien
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); this.hideModal(); }
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) this.hideModal(); });

        root.getElementById('title').addEventListener('input', () => { errorBox.textContent = ''; });

        root.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const titleValue = root.getElementById('title').value.trim();
            const descriptionValue = root.getElementById('description').value.trim();
            const dateValue = root.getElementById('date').value || this.todayLocal();
            const completedValue = root.getElementById('completed').checked;
            const categoryValue = root.getElementById('category').value || null;
            if (!titleValue) {
                errorBox.textContent = 'El título de la tarea es obligatorio.';
                root.getElementById('title').focus();
                return;
            }

            if (this.taskId) {
                // EDICION: arreglo nuevo con la tarea actualizada
                this.tasks = this.tasks.map((task) =>
                    String(task.id) === String(this.taskId)
                        ? { ...task, title: titleValue, description: descriptionValue, date: dateValue, completed: completedValue, categoryid: categoryValue}
                        : task
                );
            } else {
                // CREACION: ID local propio (nunca empieza con "api-")
                const newTask = {
                    id: StorageService.generateId('local'),
                    title: titleValue,
                    description: descriptionValue,
                    date: dateValue,
                    completed: completedValue,
                    categoryid: categoryValue
                };
                this.tasks = [newTask, ...this.tasks]; // La nueva queda arriba
            }

            this.onSuccessCallback(this.tasks);
            this.hideModal();
        });
    }

    hideModal() {
        this.shadowRoot.getElementById('modal').hidden = true;
        this.setBackgroundInert(false);
        // Si el boton que abrio el modal ya no existe (la lista se redibujo), se enfoca "Crear Tarea"
        const target = this._opener && this._opener.isConnected
            ? this._opener
            : this.getRootNode().getElementById('btn-create');
        if (target && target.focus) target.focus();
    }

    // Mientras el modal esta abierto, el resto del panel no recibe foco ni clics
    setBackgroundInert(value) {
        const rootNode = this.getRootNode();
        if (rootNode.querySelectorAll) {
            rootNode.querySelectorAll('.panel, #list-container').forEach((el) => { el.inert = value; });
        }
    }

    // Fecha local YYYY-MM-DD
    todayLocal() {
        return new Date().toLocaleDateString('en-CA');
    }
    escapeHTML(s) {
        return String(s ?? ''). replac(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    }
    renderStructure() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="css/styles.css">

            <div class="modal" id="modal" hidden>
                <div class="modal-contenido" role="dialog" aria-modal="true" aria-labelledby="modal-header-title">
                    <h2 id="modal-header-title">Nueva tarea</h2>
                    <form id="task-form" novalidate>
                        <label for="title">Título de la tarea <span style="color:#9B3D45;">*</span></label>
                        <input type="text" id="title" maxlength="120" autocomplete="off"
                            placeholder="Escribe el título..." aria-describedby="form-error">
                        <p class="form-error" id="form-error" role="alert"></p>

                        <label for="description">Descripción (opcional)</label>
                        <input type="text" id="description" maxlength="200" autocomplete="off"
                            placeholder="Escribe detalles adicionales de la tarea...">
                        <label for="category">categoria (opcional)</label>
                        <select id="category">
                          <option value="">sin categoria</option>
                        </select>
                        <label for="date">Fecha de registro</label>
                        <input type="date" id="date">

                        <div class="campo-check">
                            <input type="checkbox" id="completed">
                            <label for="completed">¿Esta tarea ya está terminada?</label>
                        </div>

                        <div class="modal-acciones">
                            <button type="submit" id="btn-save">Guardar tarea</button>
                            <button type="button" id="btn-close-form">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
}

customElements.define('task-modal', TaskModal);
