import './RankPage.css';

export default function RankPage() {
  return (
    <div className="rank-page">
      <div className="rank-container">
        <div className="rank-column ranks-column">
          <h2>Your Rankings</h2>
          <div className="sub-header">progress bar</div>
          <div className="placeholder-content">
            ranks go here
          </div>
        </div>
        
        <div className="rank-column products-column">
          <h2>Available Products</h2>
          <div className="sub-header">remaining products to rank bar</div>
          <div className="placeholder-content">
            products go here
          </div>
        </div>
      </div>
    </div>
  );
}
