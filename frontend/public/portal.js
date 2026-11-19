const navigationToggle = document.querySelector('.ops-nav-toggle');
if (navigationToggle) {
  const navigation = document.getElementById('workspace-nav');
  const compact = window.matchMedia('(max-width: 840px)');
  function resizeNavigation() {
    navigationToggle.hidden = !compact.matches;
    navigation.hidden = compact.matches;
    navigationToggle.setAttribute('aria-expanded', String(!navigation.hidden));
  }
  navigationToggle.addEventListener('click', () => {
    navigation.hidden = !navigation.hidden;
    navigationToggle.setAttribute('aria-expanded', String(!navigation.hidden));
  });
  compact.addEventListener('change', resizeNavigation);
  resizeNavigation();
}

for (const form of document.querySelectorAll('[data-bulk-form]')) {
  const all = form.querySelector('[data-select-all]');
  const rows = [...form.querySelectorAll('[data-select-row]')];
  const count = form.querySelector('[data-selection-count]');
  const submit = form.querySelector('[data-bulk-submit]');
  function refreshSelection() {
    const selected = rows.filter(row => row.checked).length;
    all.checked = selected === rows.length;
    all.indeterminate = selected > 0 && selected < rows.length;
    count.textContent = `${selected} selected${selected > 100 ? ' · Select up to 100 at a time' : ''}`;
    submit.disabled = selected === 0 || selected > 100;
    for (const row of rows) row.closest('tr').classList.toggle('is-selected', row.checked);
  }
  all.addEventListener('change', () => {
    for (const row of rows) row.checked = all.checked;
    refreshSelection();
  });
  form.addEventListener('change', refreshSelection);
  window.addEventListener('pageshow', refreshSelection);
  refreshSelection();
}

for (const picker of document.querySelectorAll('[data-team-picker]')) {
  const lead = picker.closest('form').elements.studentId;
  const filter = picker.querySelector('[data-team-filter]');
  const search = filter.querySelector('input');
  const count = picker.querySelector('[data-team-count]');
  const options = [...picker.querySelectorAll('[data-team-option]')].map((label) => ({
    label, input: label.querySelector('input'), name: label.textContent.toLowerCase(),
  }));
  function refresh() {
    const query = search.value.trim().toLowerCase();
    let members = Number(Boolean(lead.value));
    for (const { label, input, name } of options) {
      input.disabled = input.value === lead.value;
      if (input.disabled) input.checked = false;
      label.hidden = input.disabled || !name.includes(query);
      if (input.checked) members += 1;
    }
    count.textContent = `${members} ${members === 1 ? 'member' : 'members'}`;
  }
  filter.hidden = false;
  search.addEventListener('input', refresh);
  lead.addEventListener('change', refresh);
  picker.addEventListener('change', refresh);
  refresh();
}

document.getElementById('print-labels')?.addEventListener('click', () => window.print());

for (const section of document.querySelectorAll('[data-csv-fields]')) {
  const picker = section.querySelector('input[type="file"]');
  const source = section.querySelector('textarea');
  const status = section.querySelector('[data-csv-status]');
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file) return;
    if (file.size > 200000) {
      status.textContent = 'Choose a CSV file no larger than 200 KB.';
      return;
    }
    try {
      const content = await file.text();
      if (picker.files[0] !== file) return;
      source.value = content;
      status.textContent = `${file.name} loaded. Review the CSV data, then submit the form.`;
    } catch {
      status.textContent = 'The file could not be read. Choose it again or paste the CSV data.';
    }
  });
}
