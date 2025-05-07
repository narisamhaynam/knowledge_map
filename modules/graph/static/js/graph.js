const App = {
    state: {
        graphData: {nodes: [], links: []},
        currentTopic: "Machine Learning",
        nodePositions: {},
        contextNode: null,
        contextLink: null,
        similaritiesEnabled: false
    },
    
    elements: {
        svg: null,
        simulation: null,
        link: null,
        node: null,
        labels: null,
        zoom: null,
        width: 0,
        height: 0
    },
    
    init() {
        this.setupDOM();
        this.bindEvents();
        this.loadGraphData(this.state.currentTopic);
        this.showHelp();
    },
    
    setupDOM() {
        this.elements.width = document.getElementById('graph-container').clientWidth;
        this.elements.height = document.getElementById('graph-container').clientHeight;
        
        this.elements.svg = d3.select('#graph-container')
            .append('svg')
            .attr('width', this.elements.width)
            .attr('height', this.elements.height);
            
        this.elements.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                d3.select('#zoom-group').attr('transform', event.transform);
            });
            
        this.elements.svg.call(this.elements.zoom);
        
        this.elements.svg.append('g').attr('id', 'zoom-group');
    },
    
    bindEvents() {
        document.getElementById('topic-input').addEventListener('keypress', e => {
            if (e.key === 'Enter') this.changeTopic();
        });
        document.getElementById('change-topic-button').addEventListener('click', () => this.changeTopic());
        
        document.getElementById('add-term-button').addEventListener('click', () => this.autoAddTerm());
        document.getElementById('new-term-input').addEventListener('keypress', e => {
            if (e.key === 'Enter') this.autoAddTerm();
        });
        
        document.getElementById('similarity-checkbox').addEventListener('change', (e) => {
            this.state.similaritiesEnabled = e.target.checked;
            this.loadGraphData(this.state.currentTopic);
        });
        
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.elements.svg.transition().call(this.elements.zoom.scaleBy, 1.3);
        });
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.elements.svg.transition().call(this.elements.zoom.scaleBy, 0.7);
        });
        document.getElementById('zoom-reset').addEventListener('click', () => {
            this.elements.svg.transition().call(this.elements.zoom.transform, d3.zoomIdentity);
        });
        
        document.addEventListener('click', e => {
            if (!e.target.closest('#context-menu')) this.UI.hideContextMenu();
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => this.UI.hideModal());
        document.getElementById('modal-confirm').addEventListener('click', () => this.UI.confirmModal());
        
        window.addEventListener('resize', () => this.handleResize());
    },
    
    handleResize() {
        this.elements.width = document.getElementById('graph-container').clientWidth;
        this.elements.height = document.getElementById('graph-container').clientHeight;
        
        this.elements.svg.attr('width', this.elements.width)
           .attr('height', this.elements.height);
        
        if (this.elements.simulation) {
            const rootNode = this.state.graphData.nodes.find(n => n.level === 0);
            if (rootNode) {
                rootNode.x = this.elements.width / 2;
                rootNode.y = this.elements.height / 2;
                rootNode.fx = rootNode.x;
                rootNode.fy = rootNode.y;
            }
            
            this.elements.simulation.alpha(0.3).restart();
        }
    },
    
    showHelp() {
        setTimeout(() => {
            document.getElementById('help-tooltip').style.opacity = 1;
            setTimeout(() => {
                document.getElementById('help-tooltip').style.opacity = 0;
            }, 5000);
        }, 2000);
    },
    
    loadGraphData(topic, forceRegenerate = false) {
        this.UI.showLoading();
        
        fetch(`/get_graph_data?topic=${encodeURIComponent(topic)}&force=${forceRegenerate}&use_similarities=${this.state.similaritiesEnabled}`)
            .then(response => response.json())
            .then(data => {
                this.state.currentTopic = data.topic;
                this.state.graphData = data.graph_data;
                
                document.title = `Knowledge Graph: ${this.state.currentTopic}`;
                document.getElementById('topic-input').value = this.state.currentTopic;
                
                this.initializeGraph();
                this.UI.hideLoading();
            })
            .catch(error => {
                console.error('Error loading graph data:', error);
                this.UI.hideLoading();
                alert('Failed to load graph data. Please try again.');
            });
    },
    
    changeTopic() {
        const newTopic = document.getElementById('topic-input').value.trim();
        
        if (newTopic === '') {
            alert('Please enter a topic.');
            return;
        }
        
        this.loadGraphData(newTopic);
    },
    
    autoAddTerm() {
        const newTerm = document.getElementById('new-term-input').value.trim();
        
        if (newTerm === '') {
            alert('Please enter a term to add.');
            return;
        }
        
        this.UI.showLoading();
        
        const statusEl = document.getElementById('add-term-status');
        statusEl.style.display = 'block';
        statusEl.querySelector('.status-text').innerHTML = 'Finding best parent node...';
        
        fetch('/auto_add_term', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                term: newTerm,
                core_topic: this.state.currentTopic,
                calculate_similarity: this.state.similaritiesEnabled
            })
        })
        .then(response => response.json())
        .then(data => {
            this.UI.hideLoading();
            
            if (data.success) {
                document.getElementById('new-term-input').value = '';
                
                this.state.graphData = data.graph_data;
                this.initializeGraph();
                
                statusEl.querySelector('.status-text').innerHTML = 
                    `Added "<strong>${newTerm}</strong>" as a child of "<strong>${data.parent_node}</strong>" (Level ${data.level})`;
                    
                this.highlightNodes([newTerm, data.parent_node]);
            } else {
                statusEl.querySelector('.status-text').innerHTML = `<span style="color: #cc0000">Error: ${data.error}</span>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            this.UI.hideLoading();
            statusEl.querySelector('.status-text').innerHTML = '<span style="color: #cc0000">An error occurred</span>';
        });
    },
    
    expandNode(nodeId) {
        this.UI.showLoading();
        
        const statusEl = document.getElementById('add-term-status');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.querySelector('.status-text').innerHTML = 'Expanding node...';
        }
        
        fetch('/expand_node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                node_id: nodeId,
                core_topic: this.state.currentTopic,
                calculate_similarity: this.state.similaritiesEnabled
            })
        })
        .then(response => response.json())
        .then(data => {
            this.UI.hideLoading();
            
            if (data.success) {
                this.state.graphData = data.graph_data;
                this.initializeGraph();
                
                if (statusEl) {
                    statusEl.querySelector('.status-text').innerHTML = 
                        `Expanded "${nodeId}" with ${data.added_count} new concepts`;
                }
                
                if (data.new_nodes && data.new_nodes.length > 0) {
                    this.highlightNodes([nodeId, ...data.new_nodes]);
                }
            } else {
                if (statusEl) {
                    statusEl.querySelector('.status-text').innerHTML = 
                        `<span style="color: #cc0000">Error: ${data.error}</span>`;
                } else {
                    alert('Error expanding node: ' + data.error);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            this.UI.hideLoading();
            
            if (statusEl) {
                statusEl.querySelector('.status-text').innerHTML = 
                    '<span style="color: #cc0000">An error occurred</span>';
            } else {
                alert('An error occurred while expanding the node.');
            }
        });
    },
    
    highlightNodes(nodeIds) {
        if (!this.elements.node) return;
        
        this.elements.node.attr('stroke-width', 1.5)
                      .attr('stroke', '#fff');
        
        this.elements.node.filter(d => nodeIds.includes(d.id))
                      .attr('stroke-width', 3)
                      .attr('stroke', '#ff9900');
        
        setTimeout(() => {
            this.elements.node.attr('stroke-width', 1.5)
                          .attr('stroke', '#fff');
        }, 3000);
    },
    
    initializeGraph() {
        if (this.elements.node) {
            this.elements.node.each(d => {
                this.state.nodePositions[d.id] = { x: d.x, y: d.y };
            });
        }
        
        const g = this.elements.svg.select('#zoom-group');
        g.selectAll("*").remove();
        
        this.setupColorScale();
        this.setupNodePositions();
        this.setupForceSimulation();
        this.createVisualElements(g);
        
        if (this.elements.simulation) {
            this.elements.simulation.alpha(1).restart();
        }
        
        setTimeout(() => {
            if (this.elements.simulation) {
                this.elements.simulation.alpha(0.1);
            }
        }, 3000);
    },
    
    setupColorScale() {
        let maxLevel = 0;
        this.state.graphData.nodes.forEach(node => {
            maxLevel = Math.max(maxLevel, node.level);
        });
        
        this.colorScale = d3.scaleLinear()
            .domain([0, maxLevel])
            .range(["#0066cc", "#cc0000"])
            .interpolate(d3.interpolateHcl);
    },
    
    setupNodePositions() {
        const centerX = this.elements.width / 2;
        const centerY = this.elements.height / 2;
        
        const rootNode = this.state.graphData.nodes.find(n => n.level === 0);
        
        if (rootNode) {
            rootNode.x = centerX;
            rootNode.y = centerY;
            rootNode.fx = centerX;
            rootNode.fy = centerY;
        }
        
        const nodesByLevel = {};
        this.state.graphData.nodes.forEach(node => {
            if (node.level === 0) return;
            
            if (!nodesByLevel[node.level]) {
                nodesByLevel[node.level] = [];
            }
            nodesByLevel[node.level].push(node);
        });
        
        Object.keys(nodesByLevel).forEach(level => {
            const levelNodes = nodesByLevel[level];
            const numNodes = levelNodes.length;
            const radius = level * 150;
            
            levelNodes.forEach((node, i) => {
                const angle = (i / numNodes) * 2 * Math.PI;
                
                node.x = centerX + radius * Math.cos(angle);
                node.y = centerY + radius * Math.sin(angle);
            });
        });
    },
    
    setupForceSimulation() {
        const centerX = this.elements.width / 2;
        const centerY = this.elements.height / 2;
        
        const radialForce = d3.forceRadial()
            .x(centerX)
            .y(centerY)
            .radius(d => d.level * 150)
            .strength(0.8);
        
        const chargeForce = d3.forceManyBody()
            .strength(d => d.level === 0 ? -2000 : -500)
            .distanceMax(500);
            
        const linkForce = d3.forceLink(this.state.graphData.links)
            .id(d => d.id)
            .distance(link => {
                if (this.state.similaritiesEnabled && link.similarity !== null) {
                    return 100 * (1 + link.dissonance);
                } else {
                    const sourceLevel = link.source.level || 0;
                    const targetLevel = link.target.level || 0;
                    return 100 + 50 * Math.abs(targetLevel - sourceLevel);
                }
            })
            .strength(0.5);
        
        this.elements.simulation = d3.forceSimulation(this.state.graphData.nodes)
            .force('link', linkForce)
            .force('charge', chargeForce)
            .force('radial', radialForce)
            .force('collision', d3.forceCollide().radius(30))
            .alpha(1)
            .alphaDecay(0.01)
            .on('tick', () => this.simulationTick());
    },
    
    simulationTick() {
        if (!this.elements.link || !this.elements.node || !this.elements.labels) return;
        
        const rootNode = this.state.graphData.nodes.find(n => n.level === 0);
        if (rootNode) {
            rootNode.x = this.elements.width / 2;
            rootNode.y = this.elements.height / 2;
            rootNode.fx = rootNode.x;
            rootNode.fy = rootNode.y;
        }
        
        this.elements.link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        const padding = 20;
        this.elements.node
            .attr('cx', d => d.x = Math.max(padding, Math.min(this.elements.width - padding, d.x)))
            .attr('cy', d => d.y = Math.max(padding, Math.min(this.elements.height - padding, d.y)));
        
        this.elements.labels.attr('transform', d => `translate(${d.x},${d.y})`);
    },
    
    createVisualElements(g) {
        this.elements.link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(this.state.graphData.links)
            .enter().append('line')
            .attr('stroke-width', d => {
                if (this.state.similaritiesEnabled && d.similarity !== null) {
                    return 1 + (d.similarity * 3);
                } else {
                    return 2;
                }
            })
            .style('stroke-dasharray', d => d.line_type === 'dotted' ? '5,5' : 'none')
            .style('stroke-opacity', d => {
                if (this.state.similaritiesEnabled && d.similarity !== null) {
                    return 0.2 + (d.similarity * 0.6);
                } else {
                    return 0.6;
                }
            });
            
        this.elements.node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(this.state.graphData.nodes)
            .enter().append('circle')
            .attr('r', d => d.level === 0 ? 25 : 20 - (d.level * 1.5))
            .attr('fill', d => this.colorScale(d.level))
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));
                
        this.elements.node
            .on('click', (event, d) => {
                event.stopPropagation();
                this.showNodeInfo(d);
                
                if (d.level === 0) {
                    this.recenterGraph();
                }
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                this.state.contextNode = d;
                this.state.contextLink = null;
                this.UI.showNodeContextMenu(event.pageX, event.pageY, d);
            });
            
        this.elements.link.on('contextmenu', (event, d) => {
            event.preventDefault();
            this.state.contextNode = null;
            this.state.contextLink = d;
            this.UI.showLinkContextMenu(event.pageX, event.pageY, d);
        });
            
        const labelGroup = g.append('g')
            .attr('class', 'node-labels')
            .selectAll('g')
            .data(this.state.graphData.nodes)
            .enter()
            .append('g');
            
        labelGroup.append('rect')
            .attr('fill', 'white')
            .attr('fill-opacity', 0.7)
            .attr('rx', 3)
            .attr('ry', 3);
            
        const textLabels = labelGroup.append('text')
            .attr('dx', 15)
            .attr('dy', '.35em')
            .text(d => d.id);
            
        labelGroup.each(function() {
            const bbox = this.getElementsByTagName('text')[0].getBBox();
            const rect = this.getElementsByTagName('rect')[0];
            d3.select(rect)
                .attr('x', bbox.x - 2)
                .attr('y', bbox.y - 2)
                .attr('width', bbox.width + 4)
                .attr('height', bbox.height + 4);
        });
        
        this.elements.labels = labelGroup;
            
        this.elements.node.append('title')
            .text(d => `${d.id}\nLevel: ${d.level}`);
    },
    
    recenterGraph() {
        if (!this.elements.simulation) return;
        
        this.setupForceSimulation();
        
        this.elements.simulation.alpha(1).restart();
    },
    
    showNodeInfo(d) {
        const relationships = this.state.graphData.links.filter(link => 
            link.source.id === d.id || link.target.id === d.id
        );
        
        let infoHTML = `<h4>Selected: ${d.id} (Level ${d.level})</h4>`;
        
        if (relationships.length > 0) {
            infoHTML += '<h5>Relationships:</h5><ul>';
            
            relationships.forEach(rel => {
                const isParent = rel.source.id === d.id;
                const otherNode = isParent ? rel.target.id : rel.source.id;
                const relationshipType = isParent ? 'Parent of' : 'Child of';
                
                if (this.state.similaritiesEnabled && rel.similarity !== null) {
                    const similarity = (rel.similarity * 100).toFixed(1);
                    const dissonance = (rel.dissonance * 100).toFixed(1);
                    
                    infoHTML += `<li>${relationshipType} <strong>${otherNode}</strong><br>` +
                        `Similarity: ${similarity}%<br>` +
                        `Dissonance: ${dissonance}%</li>`;
                } else if (this.state.similaritiesEnabled && rel.similarity === null) {
                    infoHTML += `<li>${relationshipType} <strong>${otherNode}</strong><br>` +
                        `<em>Similarity: calculating...</em></li>`;
                } else {
                    infoHTML += `<li>${relationshipType} <strong>${otherNode}</strong></li>`;
                }
            });
            infoHTML += '</ul>';
        } else {
            infoHTML += '<p>No relationships found.</p>';
        }
        
        document.getElementById('selected-info').innerHTML = infoHTML;
        document.getElementById('selected-info-panel').style.display = 'block';
    },
    
    dragStarted(event, d) {
        if (!event.active) this.elements.simulation.alphaTarget(0.3).restart();
        
        if (d.level === 0) return;
        
        d.fx = d.x;
        d.fy = d.y;
    },
    
    dragged(event, d) {
        if (d.level === 0) return;
        
        d.fx = event.x;
        d.fy = event.y;
    },
    
    dragEnded(event, d) {
        if (!event.active) this.elements.simulation.alphaTarget(0);
        
        if (d.level === 0) return;
        
        d.fx = null;
        d.fy = null;
        
        this.elements.simulation.alpha(0.3).restart();
    },
    
    API: {
        renameNode(oldId, newId) {
            App.UI.showLoading();
            
            fetch('/rename_concept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    old_id: oldId, 
                    new_id: newId,
                    use_similarities: App.state.similaritiesEnabled
                })
            })
            .then(response => response.json())
            .then(data => {
                App.UI.hideLoading();
                
                if (data.success) {
                    App.state.graphData = data.graph_data;
                    App.initializeGraph();
                } else {
                    alert('Error renaming node: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                App.UI.hideLoading();
                alert('An error occurred while renaming the node.');
            });
        },
        
        addChildNode(parentId, childId, level) {
            App.UI.showLoading();
            
            fetch('/add_concept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    concept: childId,
                    parent: parentId,
                    level: level,
                    core_topic: App.state.currentTopic,
                    calculate_similarity: App.state.similaritiesEnabled
                })
            })
            .then(response => response.json())
            .then(data => {
                App.UI.hideLoading();
                
                if (data.success) {
                    App.state.graphData = data.graph_data;
                    App.initializeGraph();
                } else {
                    alert('Error adding child node: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                App.UI.hideLoading();
                alert('An error occurred while adding the child node.');
            });
        },
        
        insertNodeBetween(parentId, childId, newNodeId) {
            App.UI.showLoading();
            
            fetch('/insert_node', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parent_id: parentId,
                    child_id: childId,
                    new_concept: newNodeId,
                    calculate_similarity: App.state.similaritiesEnabled
                })
            })
            .then(response => response.json())
            .then(data => {
                App.UI.hideLoading();
                
                if (data.success) {
                    App.state.graphData = data.graph_data;
                    App.initializeGraph();
                } else {
                    alert('Error inserting node: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                App.UI.hideLoading();
                alert('An error occurred while inserting the node.');
            });
        },
        
        deleteNode(nodeId) {
            App.UI.showLoading();
            
            fetch('/delete_concept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    concept_id: nodeId,
                    use_similarities: App.state.similaritiesEnabled 
                })
            })
            .then(response => response.json())
            .then(data => {
                App.UI.hideLoading();
                
                if (data.success) {
                    App.state.graphData = data.graph_data;
                    App.initializeGraph();
                } else {
                    alert('Error deleting node: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                App.UI.hideLoading();
                alert('An error occurred while deleting the node.');
            });
        }
    },
    
    UI: {
        showLoading() {
            document.querySelector('.loading-spinner').style.display = 'flex';
        },
        
        hideLoading() {
            document.querySelector('.loading-spinner').style.display = 'none';
        },
        
        showNodeContextMenu(x, y, node) {
            const menu = document.getElementById('context-menu');
            menu.innerHTML = '';
            
            this.addMenuItem(menu, 'Rename Node', () => this.showRenameNodeModal(node));
            this.addMenuItem(menu, 'Add Child Node', () => this.showAddChildModal(node));
            
            if (node.level !== 0) {
                this.addMenuSeparator(menu);
                this.addMenuItem(menu, 'Delete Node', () => this.confirmDeleteNode(node), 'danger');
            }
            
            this.addMenuSeparator(menu);
            this.addMenuItem(menu, 'Expand Graph', () => App.expandNode(node.id));
            
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.style.display = 'block';
        },
        
        showLinkContextMenu(x, y, link) {
            const menu = document.getElementById('context-menu');
            menu.innerHTML = '';
            
            this.addMenuItem(menu, 'Insert Node Between', () => this.showInsertNodeModal(link));
            
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.style.display = 'block';
        },
        
        addMenuItem(menu, text, callback, className = '') {
            const item = document.createElement('div');
            item.className = 'menu-item' + (className ? ' ' + className : '');
            item.textContent = text;
            item.addEventListener('click', () => {
                this.hideContextMenu();
                callback();
            });
            menu.appendChild(item);
        },
        
        addMenuSeparator(menu) {
            const separator = document.createElement('div');
            separator.className = 'menu-separator';
            menu.appendChild(separator);
        },
        
        hideContextMenu() {
            document.getElementById('context-menu').style.display = 'none';
        },
        
        showModal() {
            document.getElementById('modal').style.display = 'flex';
        },
        
        hideModal() {
            document.getElementById('modal').style.display = 'none';
        },
        
        confirmModal() {
            this.hideModal();
        },
        
        showRenameNodeModal(node) {
            const modalTitle = document.getElementById('modal-title');
            const modalBody = document.getElementById('modal-body');
            const modalConfirm = document.getElementById('modal-confirm');
            
            modalTitle.textContent = 'Rename Node';
            modalBody.innerHTML = `
                <label for="new-name">New name for "${node.id}":</label>
                <input type="text" id="new-name" value="${node.id}">
            `;
            
            modalConfirm.onclick = function() {
                const newName = document.getElementById('new-name').value.trim();
                if (newName && newName !== node.id) {
                    App.API.renameNode(node.id, newName);
                }
                App.UI.hideModal();
            };
            
            this.showModal();
            document.getElementById('new-name').focus();
            document.getElementById('new-name').select();
        },
        
        showAddChildModal(parentNode) {
            const modalTitle = document.getElementById('modal-title');
            const modalBody = document.getElementById('modal-body');
            const modalConfirm = document.getElementById('modal-confirm');
            
            modalTitle.textContent = 'Add Child Node';
            modalBody.innerHTML = `
                <label for="child-name">New child concept for "${parentNode.id}":</label>
                <input type="text" id="child-name" placeholder="Enter concept name">
            `;
            
            modalConfirm.onclick = function() {
                const childName = document.getElementById('child-name').value.trim();
                if (childName) {
                    App.API.addChildNode(parentNode.id, childName, parentNode.level + 1);
                }
                App.UI.hideModal();
            };
            
            this.showModal();
            document.getElementById('child-name').focus();
        },
        
        showInsertNodeModal(link) {
            const sourceId = link.source.id;
            const targetId = link.target.id;
            
            const modalTitle = document.getElementById('modal-title');
            const modalBody = document.getElementById('modal-body');
            const modalConfirm = document.getElementById('modal-confirm');
            
            modalTitle.textContent = 'Insert Node Between';
            modalBody.innerHTML = `
                <p>Insert a new concept between "${sourceId}" and "${targetId}":</p>
                <input type="text" id="insert-name" placeholder="Enter concept name">
            `;
            
            modalConfirm.onclick = function() {
                const newName = document.getElementById('insert-name').value.trim();
                if (newName) {
                    App.API.insertNodeBetween(sourceId, targetId, newName);
                }
                App.UI.hideModal();
            };
            
            this.showModal();
            document.getElementById('insert-name').focus();
        },
        
        confirmDeleteNode(node) {
            const modalTitle = document.getElementById('modal-title');
            const modalBody = document.getElementById('modal-body');
            const modalConfirm = document.getElementById('modal-confirm');
            
            modalTitle.textContent = 'Confirm Deletion';
            modalBody.innerHTML = `
                <p>Are you sure you want to delete the node "${node.id}"?</p>
                <p>This will delete the node and all its descendants.</p>
            `;
            
            modalConfirm.className = 'danger';
            modalConfirm.textContent = 'Delete';
            
            modalConfirm.onclick = function() {
                App.API.deleteNode(node.id);
                App.UI.hideModal();
                
                modalConfirm.className = '';
                modalConfirm.textContent = 'Confirm';
            };
            
            this.showModal();
        }
    }
};

document.addEventListener("DOMContentLoaded", () => App.init());