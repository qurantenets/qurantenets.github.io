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
    
    // Get unique flow names for filtered data
    const flowNames = [...new Set(filteredFlowData.map(item => item.flow_name))]
        .filter(name => name) // Remove empty names
        .sort();
    
    // Clear existing options
    flowNameFilter.innerHTML = '<option value="">All Flow Types</option>';
    
    // Populate flow name filter
    flowNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        flowNameFilter.appendChild(option);
    });
}

function renderTable() {
    const tbody = document.getElementById('flowTableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedSurah = document.getElementById('surahFilter').value;
    const selectedFlowName = document.getElementById('flowNameFilter').value;
    
    let filteredData = flowData.filter(item => {
        const matchesSearch = Object.values(item).some(val => 
            String(val).toLowerCase().includes(searchTerm)
        );
        const matchesSurah = selectedSurah ? item.surah_id === parseInt(selectedSurah) : true;
        const matchesFlowName = selectedFlowName ? item.flow_name === selectedFlowName : true;
        
        return matchesSearch && matchesSurah && matchesFlowName;
    });
    
    filteredData.sort((a, b) => {
        let aVal = sortColumn === 'verses' ? a.start_verse_no : a[sortColumn];
        let bVal = sortColumn === 'verses' ? b.start_verse_no : b[sortColumn];
        
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
            <td>${item.start_verse_no} to ${item.end_verse_no}</td>
            <td>${item.surah_id}</td>
            <td>${item.flow_description || '-'}</td>
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

function changePage(page) {
    currentPage = page;
    renderTable();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadData);
document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    renderTable();
});
document.getElementById('surahFilter').addEventListener('change', () => {
    currentPage = 1;
    updateFlowNameFilter(); // Add this line
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