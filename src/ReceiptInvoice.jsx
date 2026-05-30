import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import receiptJson from "./receiptJson.json";

export default function ReceiptInvoice() {
  const [items, setItems] = useState(
    receiptJson.lineItems.map((item) => ({
      ...item,
      payMode: "full", // full | split
    }))
  );

  const [sortBy, setSortBy] = useState("az");
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  const sortedItems = useMemo(() => {
    const copy = [...items];

    if (sortBy === "az") {
      copy.sort((a, b) => a.description.localeCompare(b.description));
    }

    if (sortBy === "price") {
      copy.sort((a, b) => b.totalPrice - a.totalPrice);
    }

    if (sortBy === "category") {
      copy.sort((a, b) => a.category.localeCompare(b.category));
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
    const owed = item.payMode === "split" ? item.totalPrice / 2 : item.totalPrice;
    return sum + owed;
  }, 0);

  const originalSubtotal = receiptJson.summary.subtotal;
  const taxRatio = receiptJson.summary.tax / originalSubtotal;
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
    doc.text(`Store: ${receiptJson.store}`, 20, 32);
    doc.text(`Location: ${receiptJson.location || "N/A"}`, 20, 40);
    doc.text(`Receipt Date: ${receiptJson.date || "N/A"}`, 20, 48);
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
      const owed = item.payMode === "split" ? item.totalPrice / 2 : item.totalPrice;

      doc.text(item.description.substring(0, 28), 20, y);
      doc.text(item.category.substring(0, 22), 75, y);
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

    doc.save(`${receiptJson.store}-invoice.pdf`);

    showToast("Invoice downloaded.");
  };

  return (
    <main className="receipt-page">
      <section className="hero-panel">
        <p className="eyebrow">Receipt Splitter</p>
        <h1>{receiptJson.store} Receipt</h1>
        <p className="receipt-meta">
          {receiptJson.location && `${receiptJson.location} • `}
          Date: {receiptJson.date || "N/A"}
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
          <button className="secondary-btn" onClick={() => setAllPayModes("full")}>
            Pay Full For All
          </button>

          <button className="secondary-btn" onClick={() => setAllPayModes("split")}>
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
              const owed =
                item.payMode === "split" ? item.totalPrice / 2 : item.totalPrice;

              return (
                <article key={item.id} className="receipt-card">
                  <div className="item-main">
                    <div>
                      <h3>{item.description}</h3>
                      <p className="category-pill">{item.category}</p>
                    </div>

                    <div className="item-details">
                      <span>
                        Qty: {item.quantity} {item.unit || ""}
                      </span>
                      <span>Original: ${item.totalPrice.toFixed(2)}</span>
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
