const NVIDIA_API_KEY = "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";

let currentMode = 'chat';
let chatSessions = JSON.parse(localStorage.getItem('zhacks_chats')) || [];
let currentChatId = null;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadChatSessions();
});

function initUI() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    const chatTabBtn = document.getElementById('tab-chat-btn');
    const codeTabBtn = document.getElementById('tab-code-btn');
    const codeControls = document.getElementById('code-controls');
    const debugBtn = document.getElementById('code-debug-btn');
    const sendBtn = document.getElementById('send-prompt-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const clearAllBtn = document.getElementById('clear-all-chats-btn');
    const promptInput = document.getElementById('user-prompt-input');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    chatTabBtn.addEventListener('click', () => switchMode('chat'));
    codeTabBtn.addEventListener('click', () => switchMode('code'));

    function switchMode(mode) {
        currentMode = mode;
        if (mode === 'chat') {
            chatTabBtn.classList.add('active');
            codeTabBtn.classList.remove('active');
            codeControls.style.display = 'none';
            debugBtn.style.display = 'none';
            promptInput.placeholder = "Type your message...";
        } else {
            codeTabBtn.classList.add('active');
            chatTabBtn.classList.remove('active');
            codeControls.style.display = 'flex';
            debugBtn.style.display = 'block';
            promptInput.placeholder = "Paste code to debug or describe the script you want...";
        }
    }

    newChatBtn.addEventListener('click', () => {
        currentChatId = null;
        document.getElementById('chat-messages').innerHTML = '';
        renderRecentChatsList();
    });

    clearAllBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all chat history?")) {
            chatSessions = [];
            localStorage.removeItem('zhacks_chats');
            currentChatId = null;
            document.getElementById('chat-messages').innerHTML = '';
            renderRecentChatsList();
        }
    });

    sendBtn.addEventListener('click', () => submitQuery(false));
    debugBtn.addEventListener('click', () => submitQuery(true));

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitQuery(false);
        }
    });
}

async function submitQuery(isDebugMode) {
    const inputEl = document.getElementById('user-prompt-input');
    const promptText = inputEl.value.trim();
    if (!promptText) return;

    inputEl.value = '';

    if (!currentChatId) {
        currentChatId = Date.now().toString();
        chatSessions.unshift({
            id: currentChatId,
            title: promptText.substring(0, 30) + '...',
            messages: []
        });
    }

    const session = chatSessions.find(s => s.id === currentChatId);

    let formattedPrompt = promptText;
    let systemPrompt = "You are a clean, direct AI assistant skilled in coding and academic problem solving. Provide concise responses without filler.";

    if (currentMode === 'code') {
        const lang = document.getElementById('code-lang-select').value;
        if (isDebugMode) {
            formattedPrompt = `Language: ${lang}\nFix syntax bugs and logical errors in this code, then explain briefly:\n\n${promptText}`;
        } else {
            formattedPrompt = `Language: ${lang}\nGenerate clean, efficient code for:\n\n${promptText}`;
        }
        systemPrompt = "You are an expert developer AI assistant. Provide clean, production-ready code blocks inside markdown code formatting.";
    }

    appendMessageToUI('user', promptText);
    session.messages.push({ sender: 'user', text: promptText });
    saveChatSessions();
    renderRecentChatsList();

    try {
        const responseText = await callNvidiaViaRedirect(systemPrompt, formattedPrompt);
        appendMessageToUI('assistant', responseText);
        session.messages.push({ sender: 'assistant', text: responseText });
        saveChatSessions();
    } catch (err) {
        appendMessageToUI('assistant', '⚠️ Error generating response: ' + err.message);
    }
}

async function callNvidiaViaRedirect(systemPrompt, userPrompt) {
    const response = await fetch("/api/nvidia", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
            model: "nvidia/nemotron-3.5-lightning-30b-a3b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function appendMessageToUI(sender, text) {
    const container = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.innerText = text;

    if (sender === 'assistant') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerText = '📋 Copy';
        copyBtn.onclick = async () => {
            await navigator.clipboard.writeText(text);
            copyBtn.innerText = '✅ Copied!';
            setTimeout(() => { copyBtn.innerText = '📋 Copy'; }, 2000);
        };
        msgDiv.appendChild(document.createElement('br'));
        msgDiv.appendChild(copyBtn);
    }

    container.appendChild(msgDiv);
    document.getElementById('chat-viewport').scrollTop = document.getElementById('chat-viewport').scrollHeight;
}

function saveChatSessions() {
    localStorage.setItem('zhacks_chats', JSON.stringify(chatSessions));
}

function loadChatSessions() {
    renderRecentChatsList();
}

function renderRecentChatsList() {
    const listEl = document.getElementById('chat-list');
    listEl.innerHTML = '';

    chatSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `chat-item ${session.id === currentChatId ? 'active' : ''}`;
        item.innerText = session.title;
        item.onclick = () => {
            currentChatId = session.id;
            renderCurrentChatMessages();
            renderRecentChatsList();
        };
        listEl.appendChild(item);
    });
}

function renderCurrentChatMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    const session = chatSessions.find(s => s.id === currentChatId);
    if (session) {
        session.messages.forEach(msg => {
            appendMessageToUI(msg.sender, msg.text);
        });
    }
}