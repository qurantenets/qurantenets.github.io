let flowData = [];
let sortColumn = 'order';
let sortDirection = 'asc';
let currentPage = 1;
const itemsPerPage = 10;

// Fetch and load data
async function loadData() {
    try {
        const response = await fetch('assets/json/flow_data.json');
        const data = await response.json();
        flowData = data.flowdata;
        populateFilters();
        updateSearchSuggestions(); // Add this line
        renderTable();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('flowTableBody').innerHTML = '<tr><td colspan="5">Error loading data. Please try again.</td></tr>';
    }
}

function populateFilters() {
    const surahFilter = document.getElementById('surahFilter');
    const flowNameFilter = document.getElementById('flowNameFilter');
    
    // Get unique surahs
    const surahs = [...new Set(flowData.map(item => item.surah_id))].sort((a, b) => a - b);
    
    // Clear existing options
    surahFilter.innerHTML = '<option value="">All Surahs</option>';
    
    // Populate surah filter
    surahs.forEach(surah => {
        const option = document.createElement('option');
        option.value = surah;
        option.textContent = `Surah ${surah}`;
        surahFilter.appendChild(option);
    });
    
    // Update flow names based on selected surah
    updateFlowNameFilter();
}

// Add new function to update flow names
function updateFlowNameFilter() {
    const flowNameFilter = document.getElementById('flowNameFilter');
    const selectedSurah = document.getElementById('surahFilter').value;
    
    // Filter flow names based on selected surah
    let filteredFlowData = flowData;
    if (selectedSurah) {
        filteredFlowData = flowData.filter(item => item.surah_id === parseInt(selectedSurah));
    }
    
    // Get unique flow names and their statistics
    const flowStats = filteredFlowData.reduce((acc, item) => {
        const name = item.flow_name;
        if (!acc[name]) {
            acc[name] = {
                occurrences: 0,
                totalVerses: 0
            };
        }
        acc[name].occurrences++;
        // Calculate total verses for this occurrence
        const verseCount = item.end_verse_no - item.start_verse_no + 1;
        acc[name].totalVerses += verseCount;
        return acc;
    }, {});
    
    // Clear existing options
    flowNameFilter.innerHTML = '<option value="">All Topics (times) (verses)</option>';
    
    // Add new options with statistics
    Object.entries(flowStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([name, stats]) => {
            if (name) {
                const option = document.createElement('option');
                option.value = name;
                option.innerHTML = `
                    <div class="flow-option">
                        <span>${name} (${stats.occurrences}) (${stats.totalVerses} verses)</span>
                    </div>`;
                flowNameFilter.appendChild(option);
            }
        });
}

// Update the createVerseLink function
function createVerseLink(surah, start, end) {
    // If start and end verses are the same, use single verse format
    if (start === end) {
        return `https://quran.com/${surah}/${start}`;
    }
    return `https://quran.com/${surah}/${start}-${end}`;
}

// Add this function to parse verse ranges and check if a number falls within them
function isNumberInVerseRange(verseStr, searchNumber) {
    // Convert search input to number
    const num = parseInt(searchNumber);
    if (isNaN(num)) return false;

    // Split multiple verse ranges (e.g., "2-5, 7-9")
    const ranges = verseStr.split(',').map(r => r.trim());
    
    for (const range of ranges) {
        // Handle single verse (e.g., "5")
        if (!range.includes('-')) {
            if (parseInt(range) === num) return true;
            continue;
        }
        
        // Handle verse range (e.g., "2-5")
        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
        if (num >= start && num <= end) return true;
    }
    
    return false;
}

// Update renderTable function - modify the table row generation
function renderTable() {
    const tbody = document.getElementById('flowTableBody');
    const searchTerm = document.getElementById('searchInput').value;
    const selectedSurah = document.getElementById('surahFilter').value;
    const selectedFlowName = document.getElementById('flowNameFilter').value;
    
    let filteredData = flowData.filter(item => {
        // Check if search term is a number
        const searchNumber = parseInt(searchTerm);
        if (!isNaN(searchNumber)) {
            // Check if the number falls within the verse range
            const verses = `${item.start_verse_no}-${item.end_verse_no}`;
            return isNumberInVerseRange(verses, searchNumber);
        }
        
        // Regular text search
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
            item.flow_name.toLowerCase().includes(searchLower) ||
            `${item.start_verse_no}-${item.end_verse_no}`.includes(searchLower) ||
            item.flow_description?.toLowerCase().includes(searchLower) ||
            String(item.surah_id).includes(searchLower);
            
        const matchesSurah = selectedSurah ? item.surah_id === parseInt(selectedSurah) : true;
        const matchesFlowName = selectedFlowName ? item.flow_name === selectedFlowName : true;
        
        return matchesSearch && matchesSurah && matchesFlowName;
    });
    
    filteredData.sort((a, b) => {
        let aVal, bVal;
        
        if (sortColumn === 'verses_count') {
            aVal = a.end_verse_no - a.start_verse_no + 1;
            bVal = b.end_verse_no - b.start_verse_no + 1;
        } else if (sortColumn === 'verses') {
            aVal = a.start_verse_no;
            bVal = b.start_verse_no;
        } else {
            aVal = a[sortColumn];
            bVal = b[sortColumn];
        }
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        return sortDirection === 'asc' 
            ? aVal > bVal ? 1 : -1
            : aVal < bVal ? 1 : -1;
    });

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedData = filteredData.slice(start, start + itemsPerPage);
    
    tbody.innerHTML = paginatedData.map(item => `
        <tr>
            <td>${item.order}</td>
            <td>${item.flow_name}</td>
            <td>
                <div style="display: flex; align-items: center;">
                    <a href="${createVerseLink(item.surah_id, item.start_verse_no, item.end_verse_no)}" 
                       target="_blank" 
                       class="verse-link"
                       title="Open verses in Quran.com">
                        ${item.start_verse_no === item.end_verse_no 
                            ? item.start_verse_no 
                            : `${item.start_verse_no} to ${item.end_verse_no}`}
                    </a>
                    <button class="preview-icon" 
                            title="Preview verses"
                            onclick="openVerseModal('${createVerseLink(item.surah_id, item.start_verse_no, item.end_verse_no)}')">
                        👁️
                    </button>
                </div>
            </td>
            <td>${item.surah_id}</td>
            <td class="verses-count ${document.getElementById('showVersesCount').checked ? 'show' : ''}">
                ${item.end_verse_no - item.start_verse_no + 1}
            </td>
            <td class="${document.getElementById('showDescription').checked ? 'show' : ''}">
                ${item.flow_description || '-'}
            </td>
        </tr>
    `).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    let buttons = '';

    if (totalPages > 1) {
        buttons += `<button onclick="changePage(1)" ${currentPage === 1 ? 'disabled' : ''}>«</button>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 || 
                i === totalPages || 
                (i >= currentPage - 2 && i <= currentPage + 2)
            ) {
                buttons += `<button onclick="changePage(${i})" class="${currentPage === i ? 'active' : ''}">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                buttons += '<button disabled>...</button>';
            }
        }

        buttons += `<button onclick="changePage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>»</button>`;
    }

    pagination.innerHTML = buttons;
}

// Reset focus when page changes
function changePage(page) {
    currentPage = page;
    renderTable();
    currentFocusedLink = -1;
}

// Modify the existing filterTable function
function filterTable() {
    const searchText = searchInput.value.toLowerCase();
    const selectedSurah = surahFilter.value;
    const selectedFlowName = flowNameFilter.value;
    
    flowData.forEach((row, index) => {
        const tr = flowTableBody.children[index];
        if (!tr) return;

        let show = true;
        
        // Check if search input is a number for verse range filtering
        const searchNumber = parseInt(searchText);
        if (!isNaN(searchNumber)) {
            // If it's a number, only check verse ranges
            show = isNumberInVerseRange(row.verses, searchNumber);
        } else {
            // Existing text search logic
            show = row.flow_name.toLowerCase().includes(searchText) ||
                  row.verses.toLowerCase().includes(searchText) ||
                  row.surah_name.toLowerCase().includes(searchText) ||
                  row.description.toLowerCase().includes(searchText);
        }

        // Apply additional filters
        if (show && selectedSurah && row.surah_id !== parseInt(selectedSurah)) {
            show = false;
        }
        if (show && selectedFlowName && row.flow_name !== selectedFlowName) {
            show = false;
        }

        tr.style.display = show ? '' : 'none';
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadData);
document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    updateSearchSuggestions();
    renderTable();
});
document.getElementById('surahFilter').addEventListener('change', () => {
    currentPage = 1;
    updateFlowNameFilter();
    updateSearchSuggestions(); // Add this line
    renderTable();
});
document.getElementById('flowNameFilter').addEventListener('change', () => {
    currentPage = 1;
    renderTable();
});

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
        renderTable();
    });
});

function toggleCollapsible(button) {
    const section = button.parentElement;
    section.classList.toggle('collapsed');
}

// Initialize collapsible sections as collapsed on load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    document.querySelectorAll('.collapsible').forEach(section => {
        section.classList.add('collapsed');
    });
});

// Initialize description toggle
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    document.querySelectorAll('.collapsible').forEach(section => {
        section.classList.add('collapsed');
    });
    
    const descriptionToggle = document.getElementById('showDescription');
    descriptionToggle.addEventListener('change', function(e) {
        const isChecked = e.target.checked;
        const descriptionColumn = document.querySelector('.description-column');
        const descriptionCells = document.querySelectorAll('td:last-child');
        
        if (isChecked) {
            descriptionColumn.classList.add('show');
            descriptionCells.forEach(cell => cell.classList.add('show'));
        } else {
            descriptionColumn.classList.remove('show');
            descriptionCells.forEach(cell => cell.classList.remove('show'));
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    
    const versesCountToggle = document.getElementById('showVersesCount');
    versesCountToggle.addEventListener('change', function(e) {
        const isChecked = e.target.checked;
        const versesCountColumn = document.querySelector('.verses-count-column');
        const versesCountCells = document.querySelectorAll('td.verses-count');
        
        if (isChecked) {
            versesCountColumn.classList.add('show');
            versesCountCells.forEach(cell => cell.classList.add('show'));
        } else {
            versesCountColumn.classList.remove('show');
            versesCountCells.forEach(cell => cell.classList.remove('show'));
        }
    });
});

function updateSearchSuggestions() {
    const searchInput = document.getElementById('searchInput');
    const suggestionsDiv = document.getElementById('searchSuggestions');
    const selectedSurah = document.getElementById('surahFilter').value;
    const searchTerm = searchInput.value.toLowerCase().trim();

    // Hide suggestions if it's a number
    if (!isNaN(searchTerm)) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    // Filter flow names based on selected surah
    let filteredFlowData = flowData;
    if (selectedSurah) {
        filteredFlowData = flowData.filter(item => item.surah_id === parseInt(selectedSurah));
    }

    // Get matching flow names
    const matchingFlowNames = [...new Set(filteredFlowData
        .map(item => item.flow_name)
        .filter(name => name && name.toLowerCase().includes(searchTerm)))]
        .sort();

    // Clear existing suggestions
    suggestionsDiv.innerHTML = '';

    // Add new suggestions
    if (matchingFlowNames.length > 0) {
        matchingFlowNames.forEach(name => {
            const div = document.createElement('div');
            div.className = 'search-suggestion-item';
            div.textContent = name;
            div.addEventListener('click', () => {
                searchInput.value = name;
                suggestionsDiv.style.display = 'none';
                renderTable();
            });
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

// Update event listeners
document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    updateSearchSuggestions();
    renderTable();
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    const searchInput = document.getElementById('searchInput');
    if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
        suggestionsDiv.style.display = 'none';
    }
});

// Show suggestions when focusing on input
document.getElementById('searchInput').addEventListener('focus', () => {
    updateSearchSuggestions();
});

// Add keyboard navigation
let currentFocusedLink = -1;
// Update KEY_CODES to include ESC
const KEY_CODES = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    ESC: 27
};

function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        const links = Array.from(document.querySelectorAll('.verse-link'));
        if (!links.length) return;

        const totalPages = Math.ceil(flowData.length / itemsPerPage);

        switch (e.keyCode) {
            case KEY_CODES.LEFT:
                // Only handle left navigation if there are multiple pages
                if (totalPages > 1 && currentPage > 1) {
                    e.preventDefault();
                    changePage(currentPage - 1);
                }
                break;

            case KEY_CODES.RIGHT:
                // Only handle right navigation if there are multiple pages
                if (totalPages > 1 && currentPage < totalPages) {
                    e.preventDefault();
                    changePage(currentPage + 1);
                }
                break;

            case KEY_CODES.ESC:
                e.preventDefault();
                resetAllFilters();
                break;

            case KEY_CODES.UP:
                e.preventDefault();
                if (currentFocusedLink <= 0) {
                    currentFocusedLink = links.length - 1;
                } else {
                    currentFocusedLink--;
                }
                focusLink(links[currentFocusedLink]);
                break;

            case KEY_CODES.DOWN:
                e.preventDefault();
                if (currentFocusedLink >= links.length - 1) {
                    currentFocusedLink = 0;
                } else {
                    currentFocusedLink++;
                }
                focusLink(links[currentFocusedLink]);
                break;

            case KEY_CODES.SPACE:
                e.preventDefault();
                if (currentFocusedLink >= 0 && currentFocusedLink < links.length) {
                    window.open(links[currentFocusedLink].href, '_blank');
                }
                break;
        }
    });
}

// Add new function to reset all filters
function resetAllFilters() {
    // Reset search input
    document.getElementById('searchInput').value = '';
    
    // Reset surah filter
    document.getElementById('surahFilter').value = '';
    
    // Reset flow name filter
    document.getElementById('flowNameFilter').value = '';
    
    // Reset page
    currentPage = 1;
    
    // Reset focus
    currentFocusedLink = -1;
    
    // Update UI
    updateFlowNameFilter();
    updateSearchSuggestions();
    renderTable();
}

function focusLink(link) {
    if (link) {
        link.focus();
        link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Add CSS for focused links
const style = document.createElement('style');
style.textContent = `
    .verse-link:focus {
        outline: 2px solid #007bff;
        background-color: #f8f9fa;
        border-radius: 4px;
        padding: 2px 6px;
    }
`;
document.head.appendChild(style);

// Initialize keyboard navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    initKeyboardNavigation();
});

function openVerseModal(url) {
    const modal = document.getElementById('verseModal');
    const iframe = document.getElementById('verseFrame');
    iframe.src = url;
    modal.style.display = 'block';
}

document.querySelector('.close-modal').addEventListener('click', () => {
    const modal = document.getElementById('verseModal');
    const iframe = document.getElementById('verseFrame');
    modal.style.display = 'none';
    iframe.src = '';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('verseModal');
    if (e.target === modal) {
        modal.style.display = 'none';
        document.getElementById('verseFrame').src = '';
    }
});

// Close modal with ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('verseModal');
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
            document.getElementById('verseFrame').src = '';
        }
    }
});