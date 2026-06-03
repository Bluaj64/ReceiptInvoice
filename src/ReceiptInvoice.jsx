import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import receiptJson from "./receiptJson.json";

function getReceiptId(receipt) {
  return receipt?.receiptId || receipt?.id || receipt?.ReceiptId || "";
}

function getReceiptJson(receipt) {
  return receipt?.receiptJson || receipt?.receipt || receipt;
}

function getReceiptStore(receipt) {
  const data = getReceiptJson(receipt);
  return data?.store || receipt?.store || receipt?.merchant || "Receipt";
}

function getReceiptLocation(receipt) {
  const data = getReceiptJson(receipt);
  return data?.location || receipt?.location || "";
}

function getReceiptDate(receipt) {
  const data = getReceiptJson(receipt);
  return data?.date || receipt?.date || "";
}

function getUploadDate(receipt) {
  return receipt?.createdAt || receipt?.uploadedAt || receipt?.updatedAt || "";
}

function getReceiptTotal(receipt) {
  const data = getReceiptJson(receipt);
  return data?.summary?.total ?? receipt?.total ?? receipt?.summary?.total ?? 0;
}

function getReceiptDescriptions(receipt) {
  const data = getReceiptJson(receipt);
  const lineItems = data?.lineItems || [];

  return lineItems
    .map((item) => item?.description || "")
    .join(" ")
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function ReceiptInvoice({
  currentUser,
  onLogout,
  receiptData,
  selectedReceiptId,
  selectedFile,
  setSelectedFile,
  handleReceiptUpload,
  isProcessingReceipt,
  receiptError,
  receipts = [],
  isLoadingReceipts,
  isLoadingSelectedReceipt,
  onSelectReceipt,
  onRefreshReceipts,
  onClearCurrentReceipt,
}) {
  const activeReceipt = receiptData || receiptJson;
  const lineItems = activeReceipt.lineItems || [];
  const summary = activeReceipt.summary || {};
  const subtotal = summary.subtotal ?? 0;
  const tax = summary.tax ?? 0;

  const [items, setItems] = useState(
    lineItems.map((item) => ({
      ...item,
      payMode: "full",
    }))
  );

  const [sortBy, setSortBy] = useState("az");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptSortBy, setReceiptSortBy] = useState("uploadedNewest");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setItems(
      lineItems.map((item) => ({
        ...item,
        payMode: "full",
      }))
    );
  }, [receiptData]);

  const filteredReceipts = useMemo(() => {
    const query = receiptSearch.trim().toLowerCase();

    const filtered = receipts.filter((receipt) => {
      if (!query) return true;

      const store = getReceiptStore(receipt).toLowerCase();
      const location = getReceiptLocation(receipt).toLowerCase();
      const receiptDate = getReceiptDate(receipt).toLowerCase();
      const uploadDate = getUploadDate(receipt).toLowerCase();
      const total = String(getReceiptTotal(receipt)).toLowerCase();
      const descriptions = getReceiptDescriptions(receipt);

      return (
        store.includes(query) ||
        location.includes(query) ||
        receiptDate.includes(query) ||
        uploadDate.includes(query) ||
        total.includes(query) ||
        descriptions.includes(query)
      );
    });

    filtered.sort((a, b) => {
      if (receiptSortBy === "uploadedOldest") {
        return new Date(getUploadDate(a) || 0) - new Date(getUploadDate(b) || 0);
      }

      if (receiptSortBy === "receiptNewest") {
        return (
          new Date(getReceiptDate(b) || 0) - new Date(getReceiptDate(a) || 0)
        );
      }

      if (receiptSortBy === "receiptOldest") {
        return (
          new Date(getReceiptDate(a) || 0) - new Date(getReceiptDate(b) || 0)
        );
      }

      if (receiptSortBy === "totalHigh") {
        return Number(getReceiptTotal(b) || 0) - Number(getReceiptTotal(a) || 0);
      }

      if (receiptSortBy === "totalLow") {
        return Number(getReceiptTotal(a) || 0) - Number(getReceiptTotal(b) || 0);
      }

      if (receiptSortBy === "store") {
        return getReceiptStore(a).localeCompare(getReceiptStore(b));
      }

      return new Date(getUploadDate(b) || 0) - new Date(getUploadDate(a) || 0);
    });

    return filtered;
  }, [receipts, receiptSearch, receiptSortBy]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  const sortedItems = useMemo(() => {
    const copy = [...items];

    if (sortBy === "az") {
      copy.sort((a, b) =>
        String(a.description || "").localeCompare(String(b.description || ""))
      );
    }

    if (sortBy === "price") {
      copy.sort((a, b) => Number(b.totalPrice || 0) - Number(a.totalPrice || 0));
    }

    if (sortBy === "category") {
      copy.sort((a, b) =>
        String(a.category || "").localeCompare(String(b.category || ""))
      );
    }

    return copy;
  }, [items, sortBy]);

  const updatePayMode = (id, payMode) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, payMode } : item))
    );

    showToast(
      payMode === "split"
        ? "Item marked as split."
        : "Item marked as full payment."
    );
  };

  const setAllPayModes = (payMode) => {
    const confirmed = window.confirm(
      payMode === "split"
        ? "Split ALL items 50/50?"
        : "Mark ALL items as full payment?"
    );

    if (!confirmed) return;

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        payMode,
      }))
    );

    showToast(
      payMode === "split"
        ? "All items marked as split."
        : "All items marked as full payment."
    );
  };

  const removeItem = (id) => {
    const confirmed = window.confirm("Remove this item from the invoice?");

    if (!confirmed) return;

    setItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Item removed.");
  };

  const invoiceSubtotal = items.reduce((sum, item) => {
    const totalPrice = Number(item.totalPrice || 0);
    const owed = item.payMode === "split" ? totalPrice / 2 : totalPrice;
    return sum + owed;
  }, 0);

  const originalSubtotal = subtotal || 0;
  const taxRatio = originalSubtotal > 0 ? tax / originalSubtotal : 0;
  const invoiceTax = invoiceSubtotal * taxRatio;
  const invoiceTotal = invoiceSubtotal + invoiceTax;

  const generatePdf = () => {
    if (items.length === 0) {
      alert("No items selected for invoice.");
      return;
    }

    const confirmed = window.confirm(
      `Generate invoice for $${invoiceTotal.toFixed(2)}?`
    );

    if (!confirmed) return;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Invoice", 20, 20);

    doc.setFontSize(11);
    doc.text(`Store: ${activeReceipt.store || "N/A"}`, 20, 32);
    doc.text(`Location: ${activeReceipt.location || "N/A"}`, 20, 40);
    doc.text(`Receipt Date: ${activeReceipt.date || "N/A"}`, 20, 48);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 56);

    let y = 70;

    doc.setFontSize(10);
    doc.text("Description", 20, y);
    doc.text("Category", 75, y);
    doc.text("Mode", 125, y);
    doc.text("Owed", 165, y);

    y += 6;
    doc.line(20, y, 190, y);
    y += 8;

    items.forEach((item) => {
      const totalPrice = Number(item.totalPrice || 0);
      const owed = item.payMode === "split" ? totalPrice / 2 : totalPrice;

      doc.text(String(item.description || "Item").substring(0, 28), 20, y);
      doc.text(String(item.category || "Uncategorized").substring(0, 22), 75, y);
      doc.text(item.payMode === "split" ? "Split 50%" : "Full", 125, y);
      doc.text(`$${owed.toFixed(2)}`, 165, y);

      y += 8;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 8;
    doc.line(120, y, 190, y);
    y += 8;

    doc.text(`Subtotal: $${invoiceSubtotal.toFixed(2)}`, 125, y);
    y += 8;

    doc.text(`Estimated Tax: $${invoiceTax.toFixed(2)}`, 125, y);
    y += 8;

    doc.setFontSize(12);
    doc.text(`Total Due: $${invoiceTotal.toFixed(2)}`, 125, y);

    doc.save(`${activeReceipt.store || "receipt"}-invoice.pdf`);

    showToast("Invoice downloaded.");
  };

  return (
    <main className="receipt-page">
      <section className="app-topbar">
        <div>
          <p className="eyebrow">Signed in</p>
          <strong>
            {currentUser?.email || currentUser?.user?.email || "Receipt user"}
          </strong>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Log Out
        </button>
      </section>

      <section className="toolbar">
        <form onSubmit={handleReceiptUpload} className="sort-control">
          <span>Upload receipt</span>

          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] || null)
            }
          />

          <button type="submit" disabled={isProcessingReceipt}>
            {isProcessingReceipt ? "Processing..." : "Upload & Process"}
          </button>
        </form>

        {selectedFile && <strong>{selectedFile.name}</strong>}
      </section>

      <section className="toolbar">
        <div className="sort-control">
          <span>Receipt history</span>

          <input
            type="search"
            placeholder="Search store, date, total, items..."
            value={receiptSearch}
            onChange={(event) => setReceiptSearch(event.target.value)}
          />

          <select
            value={receiptSortBy}
            onChange={(event) => setReceiptSortBy(event.target.value)}
          >
            <option value="uploadedNewest">Upload: newest</option>
            <option value="uploadedOldest">Upload: oldest</option>
            <option value="receiptNewest">Receipt date: newest</option>
            <option value="receiptOldest">Receipt date: oldest</option>
            <option value="totalHigh">Total: high to low</option>
            <option value="totalLow">Total: low to high</option>
            <option value="store">Store A-Z</option>
          </select>

          <button
            type="button"
            className="secondary-btn"
            onClick={onRefreshReceipts}
            disabled={isLoadingReceipts}
          >
            {isLoadingReceipts ? "Refreshing..." : "Refresh"}
          </button>

          {receiptData && (
            <button
              type="button"
              className="secondary-btn"
              onClick={onClearCurrentReceipt}
            >
              Show Sample Receipt
            </button>
          )}
        </div>
      </section>

      <section className="toolbar">
        <div className="bulk-actions">
          {isLoadingReceipts && <strong>Loading receipts...</strong>}

          {!isLoadingReceipts && receipts.length === 0 && (
            <strong>No saved receipts yet</strong>
          )}

          {!isLoadingReceipts &&
            receipts.length > 0 &&
            filteredReceipts.length === 0 && (
              <strong>No receipts match your search</strong>
            )}

          {!isLoadingReceipts &&
            filteredReceipts.map((receipt) => {
              const receiptId = getReceiptId(receipt);
              const isActive = receiptId && receiptId === selectedReceiptId;
              const total = Number(getReceiptTotal(receipt) || 0);
              const store = getReceiptStore(receipt);
              const receiptDate = getReceiptDate(receipt);
              const uploadDate = getUploadDate(receipt);

              return (
                <button
                  key={receiptId}
                  type="button"
                  className={isActive ? "generate-btn" : "secondary-btn"}
                  onClick={() => onSelectReceipt(receiptId)}
                  disabled={!receiptId || isLoadingSelectedReceipt}
                  title={`Receipt date: ${formatDate(
                    receiptDate
                  )} | Uploaded: ${formatDate(uploadDate)}`}
                >
                  {isLoadingSelectedReceipt && isActive
                    ? "Loading..."
                    : `${store} • $${total.toFixed(2)} • ${formatDate(
                        receiptDate || uploadDate
                      )}`}
                </button>
              );
            })}
        </div>
      </section>

      {receiptError && <div className="auth-error">{receiptError}</div>}

      <section className="hero-panel">
        <p className="eyebrow">Receipt Splitter</p>
        <h1>{activeReceipt.store || "Receipt"} Receipt</h1>
        <p className="receipt-meta">
          {activeReceipt.location && `${activeReceipt.location} • `}
          Date: {activeReceipt.date || "N/A"}
        </p>
      </section>

      <section className="toolbar">
        <label className="sort-control">
          <span>Sort by</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="az">A-Z</option>
            <option value="price">Price</option>
            <option value="category">Category</option>
          </select>
        </label>

        <div className="bulk-actions">
          <button
            className="secondary-btn"
            onClick={() => setAllPayModes("full")}
          >
            Pay Full For All
          </button>

          <button
            className="secondary-btn"
            onClick={() => setAllPayModes("split")}
          >
            Split All
          </button>
        </div>
      </section>

      <section className="content-grid">
        <div className="items-panel">
          <div className="items-header">
            <div>
              <h2>Line Items</h2>
              <p>{sortedItems.length} items selected</p>
            </div>
          </div>

          <div className="items-list">
            {sortedItems.map((item) => {
              const totalPrice = Number(item.totalPrice || 0);
              const owed =
                item.payMode === "split" ? totalPrice / 2 : totalPrice;

              return (
                <article key={item.id} className="receipt-card">
                  <div className="item-main">
                    <div>
                      <h3>{item.description || "Item"}</h3>
                      <p className="category-pill">
                        {item.category || "Uncategorized"}
                      </p>
                    </div>

                    <div className="item-details">
                      <span>
                        Qty: {item.quantity ?? 1} {item.unit || ""}
                      </span>
                      <span>Original: ${totalPrice.toFixed(2)}</span>
                      <strong>You owe: ${owed.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="card-buttons">
                    <button onClick={() => updatePayMode(item.id, "full")}>
                      Pay Full
                    </button>

                    <button onClick={() => updatePayMode(item.id, "split")}>
                      Split
                    </button>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="summary-card">
          <p className="summary-label">Invoice Summary</p>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>${invoiceSubtotal.toFixed(2)}</strong>
          </div>

          <div className="summary-row">
            <span>Estimated Tax</span>
            <strong>${invoiceTax.toFixed(2)}</strong>
          </div>

          <div className="summary-total">
            <span>Total Due</span>
            <strong>${invoiceTotal.toFixed(2)}</strong>
          </div>

          <button onClick={generatePdf} className="generate-btn">
            Generate Invoice PDF
          </button>
        </aside>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}