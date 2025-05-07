document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.querySelector('.chat-widget');
    if (!chatContainer) return;

    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messagesContainer = document.getElementById('messages-container');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    let isInitialized = false;

    async function initChat() {
        if (isInitialized) return;
        isInitialized = true;
        
        messagesContainer.innerHTML = '';
        
        try {
            const response = await fetch('/get_graph_data');
            const data = await response.json();
            
            const contextMessage = formatGraphContext(data.graph_data);
            
            setTimeout(() => {
                const messageDiv = addMessage('assistant', 'Hello! I can help you explore and understand the knowledge graph. What would you like to know?', true);
                const messageText = messageDiv.querySelector('.message-text');
                typeMessage(messageText, 'Hello! I can help you explore and understand the knowledge graph. What would you like to know?');
            }, 500);
            
            messageInput.focus();
        } catch (error) {
            console.error('Error fetching graph data:', error);
            setTimeout(() => {
                const messageDiv = addMessage('assistant', 'Hello! I can help you explore and understand the knowledge graph. What would you like to know?', true);
                const messageText = messageDiv.querySelector('.message-text');
                typeMessage(messageText, 'Hello! I can help you explore and understand the knowledge graph. What would you like to know?');
            }, 500);
            messageInput.focus();
        }
    }

    function formatGraphContext(graphData) {
        const nodes = graphData.nodes;
        const links = graphData.links;
        
        const nodesByLevel = {};
        nodes.forEach(node => {
            if (!nodesByLevel[node.level]) {
                nodesByLevel[node.level] = [];
            }
            nodesByLevel[node.level].push(node.id);
        });
        
        let context = "Here is the current knowledge graph structure:\n\n";
        
        const rootNode = nodes.find(n => n.level === 0);
        if (rootNode) {
            context += `Root Topic: ${rootNode.id}\n\n`;
        }
        
        Object.keys(nodesByLevel).sort((a, b) => a - b).forEach(level => {
            if (level === '0') return; 
            context += `Level ${level} Concepts:\n`;
            nodesByLevel[level].forEach(nodeId => {
                context += `- ${nodeId}\n`;
            });
            context += '\n';
        });
        
        // Add relationships
        if (links.length > 0) {
            context += "Relationships:\n";
            links.forEach(link => {
                context += `- ${link.source.id} → ${link.target.id}\n`;
            });
        }
        
        return context;
    }

    async function typeMessage(element, text, speed = 10) {
        element.innerHTML = '';
        element.classList.add('typing');
        
        for (let i = 0; i < text.length; i++) {
            element.textContent = text.substring(0, i + 1);
            await new Promise(resolve => setTimeout(resolve, speed));
        }
        
        element.classList.remove('typing');
    }

    function addMessage(role, content, isAnimated = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'assistant' ? 'bot-message' : 'user-message'}`;
        
        if (isAnimated) {
            messageDiv.classList.add('message-animating');
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <div class="bot-avatar-mini"></div>
            </div>
            <div class="message-content">
                <div class="message-sender">${role === 'assistant' ? 'Graph Assistant' : 'You'}</div>
                <div class="message-text">${content}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (isAnimated) {
            requestAnimationFrame(() => {
                messageDiv.classList.remove('message-animating');
            });
        }

        return messageDiv;
    }

    function addThinkingMessage() {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-message';
        thinkingDiv.innerHTML = `
            <div class="thinking-text">Thinking...</div>
            <div class="thinking-spinner"></div>
        `;
        messagesContainer.appendChild(thinkingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return thinkingDiv;
    }

    function removeThinkingMessage(thinkingDiv) {
        if (thinkingDiv && thinkingDiv.parentNode) {
            thinkingDiv.remove();
        }
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        messageInput.value = '';

        addMessage('user', message);

        const thinkingDiv = addThinkingMessage();

        try {
            const response = await fetch('/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            console.log('Server response:', data); 

            removeThinkingMessage(thinkingDiv);

            if (data.status === 'error') {
                console.error('Server returned error:', data.message);
                addMessage('assistant', 'Sorry, there was an error processing your message. Please try again.');
                return;
            }

            if (!data.response) {
                console.error('No response content in server response');
                addMessage('assistant', 'Sorry, I received an empty response. Please try again.');
                return;
            }

            setTimeout(async () => {
                const messageDiv = addMessage('assistant', '', true);
                const messageText = messageDiv.querySelector('.message-text');
                try {
                    await typeMessage(messageText, data.response);
                } catch (error) {
                    console.error('Error during typing animation:', error);
                    messageText.textContent = data.response; 
                }
            }, 500);
        } catch (error) {
            console.error('Error sending message:', error);
            removeThinkingMessage(thinkingDiv);
            addMessage('assistant', 'Sorry, there was an error processing your message. Please try again.');
        }
    }

    window.sendPresetMessage = function(message) {
        messageInput.value = message;
        sendMessage();
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-content`).classList.add('active');
            
            if (tabId === 'chat') {
                initChat();
                messageInput.focus();
            }
        });
    });

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    const chatTab = document.querySelector('.tab-button[data-tab="chat"]');
    if (chatTab && chatTab.classList.contains('active') && !isInitialized) {
        initChat();
    }
}); 
