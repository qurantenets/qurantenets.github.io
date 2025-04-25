let flowData = [];
let sortColumn = 'order';
let sortDirection = 'asc';

// Fetch and load data
async function loadData() {
    const response = await fetch('assets/json/flow_data.json');
    const data = await response.json();
    flowData = data.flowdata;
    populateFilters();
    renderTable();
}

// Populate filter dropdowns
function populateFilters() {
    const surahFilter = document.getElementById('surahFilter');
    const flowNameFilter = document.getElementById('flowNameFilter');
    
    // Get unique values
    const surahs = [...new Set(flowData.map(item => item.surah_id))];
    const flowNames = [...new Set(flowData.map(item => item.flow_name))];
    
    // Populate surah filter
    surahs.forEach(surah => {
        const option = document.createElement('option');
        option.value = surah;
        option.textContent = `Surah ${surah}`;
        surahFilter.appendChild(option);
    });
    
    // Populate flow name filter
    flowNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        flowNameFilter.appendChild(option);
    });
}

// Render table with filtered and sorted data
function renderTable() {
    const tbody = document.getElementById('flowTableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedSurah = document.getElementById('surahFilter').value;
    const selectedFlowName = document.getElementById('flowNameFilter').value;
    
    // Filter data
    let filteredData = flowData.filter(item => {
        const matchesSearch = Object.values(item).some(val => 
            String(val).toLowerCase().includes(searchTerm)
        );
        const matchesSurah = selectedSurah ? item.surah_id === parseInt(selectedSurah) : true;
        const matchesFlowName = selectedFlowName ? item.flow_name === selectedFlowName : true;
        
        return matchesSearch && matchesSurah && matchesFlowName;
    });
    
    // Sort data
    filteredData.sort((a, b) => {
        let aVal = sortColumn === 'verses' ? a.start_verse_no : a[sortColumn];
        let bVal = sortColumn === 'verses' ? b.start_verse_no : b[sortColumn];
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        return sortDirection === 'asc' 
            ? aVal > bVal ? 1 : -1
            : aVal < bVal ? 1 : -1;
    });
    
    // Render rows
    tbody.innerHTML = filteredData.map(item => `
        <tr>
            <td>${item.order}</td>
            <td>${item.flow_name}</td>
            <td>${item.start_verse_no} to ${item.end_verse_no}</td>
            <td>${item.surah_id}</td>
            <td>${item.flow_description || '-'}</td>
        </tr>
    `).join('');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadData);

document.getElementById('searchInput').addEventListener('input', renderTable);
document.getElementById('surahFilter').addEventListener('change', renderTable);
document.getElementById('flowNameFilter').addEventListener('change', renderTable);

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