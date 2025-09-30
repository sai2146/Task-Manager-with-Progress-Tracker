class TaskManager {
    constructor() {
        this.tasks = this.loadTasks();
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderTasks();
        this.updateProgress();
        this.updateAssigneeFilter();
        this.updateDashboard();
    }

    bindEvents() {
        document.getElementById('taskForm').addEventListener('submit', (e) => this.addTask(e));
        document.getElementById('assigneeFilter').addEventListener('change', () => this.renderTasks());
        document.getElementById('statusFilter').addEventListener('change', () => this.renderTasks());
        document.getElementById('taskSearch').addEventListener('input', () => this.renderTasks());
        document.getElementById('assigneeSearch').addEventListener('input', () => this.renderAssigneeList());
    }

    addTask(e) {
        e.preventDefault();
        const task = {
            id: Date.now().toString(),
            assigneeName: document.getElementById('assigneeName').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            deadline: document.getElementById('taskDeadline').value,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.updateProgress();
        this.updateAssigneeFilter();
        this.updateDashboard();
        e.target.reset();
    }

    completeTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;

        this.saveTasks();
        this.renderTasks();
        this.updateProgress();
        this.updateDashboard();
    }

    deleteTask(id) {
        if (!confirm('Delete this task?')) return;

        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.renderTasks();
        this.updateProgress();
        this.updateAssigneeFilter();
        this.updateDashboard();
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        const assigneeFilter = document.getElementById('assigneeFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchQuery = document.getElementById('taskSearch').value.toLowerCase();

        let filteredTasks = this.tasks;

        if (assigneeFilter !== 'all') filteredTasks = filteredTasks.filter(t => t.assigneeName === assigneeFilter);
        if (statusFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => {
                switch (statusFilter) {
                    case 'completed': return task.completed;
                    case 'pending': return !task.completed && !this.isOverdue(task);
                    case 'overdue': return !task.completed && this.isOverdue(task);
                }
            });
        }

        if (searchQuery) filteredTasks = filteredTasks.filter(t =>
            t.description.toLowerCase().includes(searchQuery) || t.assigneeName.toLowerCase().includes(searchQuery)
        );

        if (filteredTasks.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:#7f8c8d;">No tasks found</div>';
            return;
        }

        container.innerHTML = filteredTasks.map(task => this.createTaskCard(task)).join('');
    }

    createTaskCard(task) {
        const isOverdue = this.isOverdue(task);
        const isDueSoon = this.isDueSoon(task);

        let cardClass = 'task-card';
        if (task.completed) cardClass += ' completed';
        else if (isOverdue) cardClass += ' overdue';
        else if (isDueSoon) cardClass += ' due-soon';

        const deadlineText = this.formatDeadline(task.deadline);
        const completeBtnText = task.completed ? 'Mark Pending' : 'Complete';
        const completeBtnClass = task.completed ? 'btn-pending' : 'btn-complete';

        return `
            <div class="${cardClass}">
                <div class="task-header">
                    <div class="assignee-name">${task.assigneeName}</div>
                </div>
                <div class="task-description ${task.completed ? 'completed' : ''}">
                    ${task.description}
                </div>
                <div class="task-footer">
                    <div class="task-deadline ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                        ${deadlineText} - ${this.getDeadlineStatus(task)}
                    </div>
                    <div class="task-actions">
                        <button class="btn ${completeBtnClass}" onclick="taskManager.completeTask('${task.id}')">${completeBtnText}</button>
                        <button class="btn btn-delete" onclick="taskManager.deleteTask('${task.id}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }

    updateProgress() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.completed).length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const progressBar = document.getElementById('overallProgress');
        const progressText = document.getElementById('progressText');

        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}% Complete (${completedTasks}/${totalTasks})`;
    }

    updateAssigneeFilter() {
        const select = document.getElementById('assigneeFilter');
        const assignees = [...new Set(this.tasks.map(t => t.assigneeName))];
        const currentValue = select.value;

        select.innerHTML = '<option value="all">All Assignees</option>';
        assignees.forEach(name => select.innerHTML += `<option value="${name}">${name}</option>`);

        if (assignees.includes(currentValue)) select.value = currentValue;
    }

    updateDashboard() {
        const totalAssignees = new Set(this.tasks.map(t => t.assigneeName)).size;
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.completed).length;
        const overdueTasks = this.tasks.filter(t => !t.completed && this.isOverdue(t)).length;

        document.getElementById('totalAssignees').textContent = totalAssignees;
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('overdueTasks').textContent = overdueTasks;

        this.renderAssigneeList();
    }

    renderAssigneeList() {
        const list = document.getElementById('assigneeList');
        const searchQuery = document.getElementById('assigneeSearch').value.toLowerCase();

        let assigneeStats = this.getAssigneeStats();

        if (searchQuery) {
            assigneeStats = assigneeStats.filter(a => a.name.toLowerCase().includes(searchQuery));
        }

        if (assigneeStats.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:#7f8c8d;">No assignee data available</div>';
            return;
        }

        list.innerHTML = assigneeStats.map(a => `
            <div class="assignee-card">
                <div class="assignee-header">
                    <div class="assignee-name-title">${a.name}</div>
                    <div class="completion-rate">${Math.round(a.completionRate)}%</div>
                </div>
                <div class="assignee-progress">
                    <div class="assignee-progress-bar">
                        <div class="assignee-progress-fill" style="width: ${a.completionRate}%"></div>
                    </div>
                </div>
                <div class="assignee-stats">
                    <div class="assignee-stat">
                        <div class="number">${a.totalTasks}</div>
                        <div class="label">Total</div>
                    </div>
                    <div class="assignee-stat">
                        <div class="number">${a.completedTasks}</div>
                        <div class="label">Completed</div>
                    </div>
                    <div class="assignee-stat">
                        <div class="number">${a.overdueTasks}</div>
                        <div class="label">Overdue</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    getAssigneeStats() {
        const assignees = [...new Set(this.tasks.map(t => t.assigneeName))];

        return assignees.map(name => {
            const tasks = this.tasks.filter(t => t.assigneeName === name);
            const completedTasks = tasks.filter(t => t.completed).length;
            const overdueTasks = tasks.filter(t => !t.completed && this.isOverdue(t)).length;

            return {
                name,
                totalTasks: tasks.length,
                completedTasks,
                overdueTasks,
                completionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0
            };
        }).sort((a, b) => b.completionRate - a.completionRate);
    }

    isOverdue(task) {
        if (task.completed) return false;
        const today = new Date();
        const deadline = new Date(task.deadline);
        today.setHours(0,0,0,0);
        deadline.setHours(0,0,0,0);
        return deadline < today;
    }

    isDueSoon(task) {
        if (task.completed) return false;
        const today = new Date();
        const deadline = new Date(task.deadline);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate()+1);

        today.setHours(0,0,0,0);
        deadline.setHours(0,0,0,0);
        tomorrow.setHours(0,0,0,0);

        return deadline.getTime() === today.getTime() || deadline.getTime() === tomorrow.getTime();
    }

    formatDeadline(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    getDeadlineStatus(task) {
        if (task.completed) return 'Completed';
        const today = new Date();
        const deadline = new Date(task.deadline);
        today.setHours(0,0,0,0);
        deadline.setHours(0,0,0,0);

        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000*60*60*24));

        if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
        else if (diffDays === 0) return 'Due today';
        else if (diffDays === 1) return 'Due tomorrow';
        else return `${diffDays} days remaining`;
    }

    loadTasks() {
        const stored = localStorage.getItem('taskManager');
        return stored ? JSON.parse(stored) : [];
    }

    saveTasks() {
        localStorage.setItem('taskManager', JSON.stringify(this.tasks));
    }
}

function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');

    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName+'Tab').classList.add('active');
    event.target.classList.add('active');

    if(tabName==='dashboard') taskManager.updateDashboard();
}

const taskManager = new TaskManager();
