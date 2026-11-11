import os

file_path = "admin/views/transactions/list.ejs"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Quick actions
target1 = """							<a href="/admin/transaction-categories" class="btn btn-secondary">
								<i class="fa fa-tags"></i> Manage Categories
							</a>
						</div>"""
replacement1 = """							<a href="/admin/transaction-categories" class="btn btn-secondary">
								<i class="fa fa-tags"></i> Manage Categories
							</a>
							<button type="button" id="generateCombinedBtn" class="btn btn-warning" style="display: none;">
								<i class="fa fa-receipt"></i> Generate Combined Receipt (<span id="selectedTxCount">0</span>)
							</button>
						</div>"""
content = content.replace(target1, replacement1)

# 2. Table Header
target2 = """						<thead>
							<tr>
								<th>Type</th>"""
replacement2 = """						<thead>
							<tr>
								<th width="1%">
									<input type="checkbox" id="selectAllTx" title="Select all visible income transactions">
								</th>
								<th>Type</th>"""
content = content.replace(target2, replacement2)

# 3. Table Row
target3 = """									<tr data-transaction-id="<%= transaction.id %>" data-type="<%= transaction.type %>" data-account="<%= transaction.accountId %>" data-category="<%= transaction.categoryName.toLowerCase() %>" data-category-id="<%= transaction.categoryId %>" data-date="<%= transaction.date %>" data-apartment="<%= transaction.apartmentNumber ? transaction.apartmentNumber.toLowerCase() : '' %>" data-owner="<%= transaction.apartmentOwnerName ? transaction.apartmentOwnerName.toLowerCase() : '' %>">
										<td>"""
replacement3 = """									<tr data-transaction-id="<%= transaction.id %>" data-type="<%= transaction.type %>" data-account="<%= transaction.accountId %>" data-category="<%= transaction.categoryName.toLowerCase() %>" data-category-id="<%= transaction.categoryId %>" data-date="<%= transaction.date %>" data-apartment="<%= transaction.apartmentNumber ? transaction.apartmentNumber.toLowerCase() : '' %>" data-owner="<%= transaction.apartmentOwnerName ? transaction.apartmentOwnerName.toLowerCase() : '' %>">
										<td>
											<% if (transaction.type === 'income') { %>
												<input type="checkbox" class="tx-checkbox" value="<%= transaction.id %>">
											<% } %>
										</td>
										<td>"""
content = content.replace(target3, replacement3)

# 4. Empty State Colspan
target4 = """									<td colspan="11" class="text-center text-muted py-4">"""
replacement4 = """									<td colspan="12" class="text-center text-muted py-4">"""
content = content.replace(target4, replacement4)

# 5. JS logic
target5 = """	function deleteTransaction(id, description) {"""
replacement5 = """	document.addEventListener('DOMContentLoaded', function() {
		const selectAllTx = document.getElementById('selectAllTx');
		const generateCombinedBtn = document.getElementById('generateCombinedBtn');
		const selectedTxCount = document.getElementById('selectedTxCount');
		
		function updateCombinedReceiptButton() {
			const visibleCheckboxes = Array.from(document.querySelectorAll('tbody tr:not([style*="display: none"]) .tx-checkbox'));
			const selectedCheckboxes = visibleCheckboxes.filter(cb => cb.checked);
			
			if (selectedCheckboxes.length > 1) {
				generateCombinedBtn.style.display = 'inline-block';
				selectedTxCount.textContent = selectedCheckboxes.length;
			} else {
				generateCombinedBtn.style.display = 'none';
			}
			
			if (selectAllTx && visibleCheckboxes.length > 0) {
				selectAllTx.checked = selectedCheckboxes.length === visibleCheckboxes.length;
			}
		}
		
		if (selectAllTx) {
			selectAllTx.addEventListener('change', function() {
				const visibleCheckboxes = document.querySelectorAll('tbody tr:not([style*="display: none"]) .tx-checkbox');
				visibleCheckboxes.forEach(cb => {
					cb.checked = this.checked;
				});
				updateCombinedReceiptButton();
			});
		}
		
		document.querySelector('table').addEventListener('change', function(e) {
			if (e.target && e.target.classList.contains('tx-checkbox')) {
				updateCombinedReceiptButton();
			}
		});
		
		if (generateCombinedBtn) {
			generateCombinedBtn.addEventListener('click', function() {
				const selectedCheckboxes = Array.from(document.querySelectorAll('tbody tr:not([style*="display: none"]) .tx-checkbox')).filter(cb => cb.checked);
				
				if (selectedCheckboxes.length < 2) {
					alert('Please select at least 2 transactions to generate a combined receipt.');
					return;
				}
				
				let selectedApartment = null;
				let selectedOwner = null;
				let isValid = true;
				const transactionIds = [];
				
				for (let i = 0; i < selectedCheckboxes.length; i++) {
					const cb = selectedCheckboxes[i];
					const row = cb.closest('tr');
					const apartment = row.dataset.apartment;
					const owner = row.dataset.owner;
					
					if (!apartment || !owner || apartment.trim() === '' || owner.trim() === '') {
						alert('All selected transactions must be assigned to an apartment and owner to generate a combined receipt.');
						isValid = false;
						break;
					}
					
					if (i === 0) {
						selectedApartment = apartment;
						selectedOwner = owner;
					} else if (apartment !== selectedApartment || owner !== selectedOwner) {
						alert('All selected transactions must belong to the exact same apartment and owner.');
						isValid = false;
						break;
					}
					
					transactionIds.push(cb.value);
				}
				
				if (isValid) {
					const originalText = generateCombinedBtn.innerHTML;
					generateCombinedBtn.disabled = true;
					generateCombinedBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating...';
					
					fetch('/admin/transactions/generate-combined-receipt', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ transactionIds })
					})
					.then(response => response.json())
					.then(result => {
						if (result.success) {
							window.open(result.receiptUrl, '_blank');
							setTimeout(() => location.reload(), 1000);
						} else {
							alert(result.message || 'Error generating receipt.');
							generateCombinedBtn.disabled = false;
							generateCombinedBtn.innerHTML = originalText;
						}
					})
					.catch(error => {
						console.error('Error:', error);
						alert('Error generating receipt.');
						generateCombinedBtn.disabled = false;
						generateCombinedBtn.innerHTML = originalText;
					});
				}
			});
		}
		
		// Hook into filtering
		const filters = document.querySelectorAll('#keywordFilter, #typeFilter, #categoryFilter, #accountFilter, #fromDateFilter, #toDateFilter');
		filters.forEach(f => {
			f.addEventListener('input', () => setTimeout(updateCombinedReceiptButton, 100));
			f.addEventListener('change', () => setTimeout(updateCombinedReceiptButton, 100));
		});
		
		const perPageSelect = document.getElementById('perPageSelect');
		if (perPageSelect) {
			perPageSelect.addEventListener('change', () => setTimeout(updateCombinedReceiptButton, 100));
		}
		
		const paginationControls = document.getElementById('paginationControls');
		if (paginationControls) {
			paginationControls.addEventListener('click', () => setTimeout(updateCombinedReceiptButton, 100));
		}
	});

	function deleteTransaction(id, description) {"""
content = content.replace(target5, replacement5)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("list.ejs patched successfully")
