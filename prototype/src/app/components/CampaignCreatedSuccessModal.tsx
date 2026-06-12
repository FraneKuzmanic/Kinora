import { CheckCircle, Vote, ArrowRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useNavigate } from "react-router";

export function CampaignCreatedSuccessModal() {
  const { closeModal } = useAppContext();
  const navigate = useNavigate();

  const handleViewCampaigns = () => {
    closeModal();
    navigate("/voting");
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl mb-2">Campaign Created!</h2>
        
        {/* Message */}
        <p className="text-muted-foreground mb-6">
          Your voting campaign has been successfully created and is now live. Moviegoers can start voting for their favorite film.
        </p>

        {/* Info Box */}
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6 text-left">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Vote className="w-4 h-4 text-primary" />
            What happens next?
          </h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>The campaign will appear on the Voting page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Moviegoers can vote until the deadline</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>The winning film moves to screening phase</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={handleViewCampaigns}
            className="flex-1 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            View Campaigns
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
