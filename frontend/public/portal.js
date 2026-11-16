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
