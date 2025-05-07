(function() {
    let isInitialized = false;
    
    function initFlashcards() {
        if (isInitialized) {
            console.log("Flashcards already initialized, skipping");
            return;
        }
        
        isInitialized = true;
        const termSelect = document.getElementById('termSelect');
        const categoryFilter = document.getElementById('categoryFilter');
        const levelFilter = document.getElementById('levelFilter');
        const flashcardContainer = document.getElementById('flashcardContainer');
        const listContainer = document.getElementById('listContainer');
        const noTermsMessage = document.getElementById('no-terms-message');
        const loading = document.getElementById('loading');
        const flashcard = document.getElementById('flashcard');
        const termElement = document.getElementById('term');
        const definitionElement = document.getElementById('definition');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        const toggleViewBtn = document.getElementById('toggleViewBtn');
        const currentIndexElement = document.getElementById('currentIndex');
        const totalCardsElement = document.getElementById('totalCards');
        
        if (!termSelect || !flashcardContainer) {
            console.error("Required flashcard elements not found");
            return;
        }
        
        let allTerms = [];
        let categories = [];
        let currentTerms = [];
        let currentIndex = 0;
        let viewMode = 'card'; 
        let termDefinitions = {}; 
        
        init();
        
        async function init() {
            showLoading(true);
            
            try {
                await Promise.all([
                    fetchTerms(),
                    fetchCategories()
                ]);
                
                setupEventListeners();
                applyFilters();
            } catch (error) {
                console.error('Error initializing flashcards:', error);
            } finally {
                showLoading(false);
            }
        }
        
        async function fetchTerms() {
            try {
                const response = await fetch('/flashcards/terms');
                const data = await response.json();
                
                if (data.status === 'success') {
                    allTerms = data.terms;
                    console.log(`Loaded ${allTerms.length} terms`);
                } else {
                    console.error(data.message);
                }
            } catch (error) {
                console.error('Error fetching terms:', error);
            }
        }
        
        async function fetchCategories() {
            try {
                const response = await fetch('/flashcards/categories');
                const data = await response.json();
                
                if (data.status === 'success') {
                    categories = data.categories;
                    
                    categoryFilter.innerHTML = '<option value="">All Categories</option>';
                    categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        categoryFilter.appendChild(option);
                    });
                    
                    console.log(`Loaded ${categories.length} categories`);
                } else {
                    console.error(data.message);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        }
        
        async function fetchDefinition(term) {
            if (termDefinitions[term]) {
                return termDefinitions[term];
            }
            
            showLoading(true);
            
            try {
                const response = await fetch('/flashcards/definition', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ term })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    termDefinitions[term] = data.definition;
                    return data.definition;
                } else {
                    console.error(data.message);
                    return 'Definition not available.';
                }
            } catch (error) {
                console.error('Error fetching definition:', error);
                return 'Definition not available.';
            } finally {
                showLoading(false);
            }
        }
        
        async function applyFilters() {
            const category = categoryFilter.value;
            const level = levelFilter.value;
            
            showLoading(true);
            
            try {
                let filteredTerms = [...allTerms];
                
                if (category) {
                    const response = await fetch(`/flashcards/filter-by-parent/${category}`);
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        filteredTerms = data.terms;
                    }
                }
                
                if (level) {
                    const response = await fetch(`/flashcards/filter-by-level/${level}`);
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        if (category) {
                            filteredTerms = filteredTerms.filter(term => data.terms.includes(term));
                        } else {
                            filteredTerms = data.terms;
                        }
                    }
                }
                
                currentTerms = filteredTerms;
                
                updateTermDropdown();
                
                if (currentTerms.length > 0) {
                    currentIndex = 0;
                    
                    if (viewMode === 'card') {
                        await displayCurrentFlashcard();
                    } else {
                        await generateListView();
                    }
                    
                    if (viewMode === 'card') {
                        flashcardContainer.classList.remove('hidden');
                    } else {
                        listContainer.classList.remove('hidden');
                    }
                    
                    noTermsMessage.classList.add('hidden');
                    
                    shuffleBtn.disabled = false;
                } else {
                    flashcardContainer.classList.add('hidden');
                    listContainer.classList.add('hidden');
                    
                    noTermsMessage.classList.remove('hidden');
                    
                    shuffleBtn.disabled = true;
                }
            } catch (error) {
                console.error('Error applying filters:', error);
            } finally {
                showLoading(false);
            }
        }
        
        function updateTermDropdown() {
            termSelect.innerHTML = '<option value="">Select a term...</option>';
            
            currentTerms.forEach(term => {
                const option = document.createElement('option');
                option.value = term;
                option.textContent = term;
                termSelect.appendChild(option);
            });
        }
        
        async function displayCurrentFlashcard() {
            if (currentTerms.length === 0) return;
            
            const term = currentTerms[currentIndex];
            termElement.textContent = term;
            
            const definition = await fetchDefinition(term);
            definitionElement.textContent = definition;
            
            flashcard.classList.remove('flipped');
            
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex === currentTerms.length - 1;
            
            currentIndexElement.textContent = currentIndex + 1;
            totalCardsElement.textContent = currentTerms.length;
        }
        
        async function generateListView() {
            listContainer.classList.remove('hidden');
            flashcardContainer.classList.add('hidden');
            
            const termList = document.querySelector('.term-list');
            termList.innerHTML = '';
            
            showLoading(true);
            
            try {
                for (const term of currentTerms) {
                    const definition = await fetchDefinition(term);
                    
                    const termItem = document.createElement('div');
                    termItem.className = 'term-item';
                    
                    const termHeading = document.createElement('h3');
                    termHeading.textContent = term;
                    
                    const definitionPara = document.createElement('p');
                    definitionPara.textContent = definition;
                    
                    termItem.appendChild(termHeading);
                    termItem.appendChild(definitionPara);
                    termList.appendChild(termItem);
                }
            } catch (error) {
                console.error('Error generating list view:', error);
            } finally {
                showLoading(false);
            }
        }
        
        function shuffleTerms() {
            currentTerms = [...currentTerms];
            for (let i = currentTerms.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentTerms[i], currentTerms[j]] = [currentTerms[j], currentTerms[i]];
            }
            currentIndex = 0;
            
            updateTermDropdown();
            
            if (viewMode === 'card') {
                displayCurrentFlashcard();
            } else {
                generateListView();
            }
        }
        
        function toggleView() {
            if (viewMode === 'card') {
                viewMode = 'list';
                toggleViewBtn.textContent = 'Card View';
                flashcardContainer.classList.add('hidden');
                generateListView();
            } else {
                viewMode = 'card';
                toggleViewBtn.textContent = 'List View';
                listContainer.classList.add('hidden');
                
                flashcardContainer.classList.remove('hidden');
                
                if (currentIndex >= currentTerms.length) {
                    currentIndex = 0;
                }
                
                displayCurrentFlashcard();
            }
        }
        
        function showLoading(show) {
            if (loading) {
                if (show) {
                    loading.classList.remove('hidden');
                } else {
                    loading.classList.add('hidden');
                }
            }
        }
        
        function setupEventListeners() {
            if (categoryFilter) {
                categoryFilter.addEventListener('change', applyFilters);
            }
            
            if (levelFilter) {
                levelFilter.addEventListener('change', applyFilters);
            }
            
            if (termSelect) {
                termSelect.addEventListener('change', function() {
                    const selectedTerm = this.value;
                    if (selectedTerm) {
                        const index = currentTerms.indexOf(selectedTerm);
                        if (index !== -1) {
                            currentIndex = index;
                            
                            if (viewMode === 'card') {
                                displayCurrentFlashcard();
                            }
                        }
                    }
                });
            }
            
            if (flashcard) {
                flashcard.addEventListener('click', function() {
                    this.classList.toggle('flipped');
                });
            }
            
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    if (currentIndex > 0) {
                        currentIndex--;
                        displayCurrentFlashcard();
                    }
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    if (currentIndex < currentTerms.length - 1) {
                        currentIndex++;
                        displayCurrentFlashcard();
                    }
                });
            }
            
            if (shuffleBtn) {
                shuffleBtn.addEventListener('click', shuffleTerms);
            }
            
            if (toggleViewBtn) {
                toggleViewBtn.addEventListener('click', toggleView);
            }
            
            document.addEventListener('keydown', function(e) {
                if (viewMode === 'card' && flashcardContainer && !flashcardContainer.classList.contains('hidden')) {
                    if (e.key === 'ArrowLeft' && !prevBtn.disabled) {
                        prevBtn.click();
                    } else if (e.key === 'ArrowRight' && !nextBtn.disabled) {
                        nextBtn.click();
                    } else if ((e.key === ' ' || e.key === 'Spacebar') && document.activeElement === flashcard) {
                        flashcard.click();
                        e.preventDefault(); 
                    }
                }
            });
            
            document.addEventListener('graphUpdated', function(event) {
                console.log('Graph updated event received in flashcards');
                
                const graphTerms = event.detail.terms;
                
                allTerms = graphTerms;
                
                fetchCategories();
                
                applyFilters();
            });
        }
    }
    
    window.initFlashcards = initFlashcards;
    
    const isEmbedded = document.getElementById('flashcards-panel') !== null;
    
    document.addEventListener('DOMContentLoaded', function() {
        if (!isEmbedded) {
            initFlashcards();
        }
    });
})();
