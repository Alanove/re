using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;

namespace ShippingClientCSharp.CancelPickup
{
    public partial class frmCancelPickupCallResponse : Form
    {
        public frmCancelPickupCallResponse()
        {
            InitializeComponent();
        }

        #region "Members"
        private PickupCancelationResponse _Response = null;
        #endregion

        #region "Properties"
        public PickupCancelationResponse Response
        {
            set { _Response = value; }
        }
        #endregion

        #region "Methods"
        private void frmCancelPickupCallResponse_Load(System.Object sender, System.EventArgs e)
        {
            if ((_Response == null))
                return;

            TreeNode _TransactionNode = new TreeNode("Transaction");
            if ((_Response.Transaction != null))
            {
                _TransactionNode.Nodes.Add("Reference1 = '" + (string.IsNullOrEmpty(_Response.Transaction.Reference1) ? string.Empty : _Response.Transaction.Reference1) + "'");
                _TransactionNode.Nodes.Add("Reference2 = '" + (string.IsNullOrEmpty(_Response.Transaction.Reference2) ? string.Empty : _Response.Transaction.Reference2) + "'");
                _TransactionNode.Nodes.Add("Reference3 = '" + (string.IsNullOrEmpty(_Response.Transaction.Reference3) ? string.Empty : _Response.Transaction.Reference3) + "'");
                _TransactionNode.Nodes.Add("Reference4 = '" + (string.IsNullOrEmpty(_Response.Transaction.Reference4) ? string.Empty : _Response.Transaction.Reference4) + "'");
                _TransactionNode.Nodes.Add("Reference5 = '" + (string.IsNullOrEmpty(_Response.Transaction.Reference5) ? string.Empty : _Response.Transaction.Reference5) + "'");
            }

            TreeNode _HasErrorsNode = new TreeNode("HasErrors = '" + _Response.HasErrors.ToString() + "'");

            TreeNode _NotificationsNode = new TreeNode("Notifications");
            if ((_Response.Notifications != null))
            {
                for (int _Index = 0; _Index <= _Response.Notifications.Count() - 1; _Index++)
                {
                    TreeNode _NotificationNode = new TreeNode("Notification " + (_Index + 1).ToString());
                    _NotificationNode.Nodes.Add("Code = '" + _Response.Notifications[_Index].Code + "'");
                    _NotificationNode.Nodes.Add("Message = '" + _Response.Notifications[_Index].Message + "'");

                    _NotificationsNode.Nodes.Add(_NotificationNode);
                }
            }

            TreeNode _RootNode = new TreeNode("Response");
            _RootNode.Nodes.Add(_TransactionNode);
            _RootNode.Nodes.Add(_HasErrorsNode);
            _RootNode.Nodes.Add(_NotificationsNode);

            tvResponse.Nodes.Add(_RootNode);
            tvResponse.ExpandAll();
        }

        private void btnExit_Click(System.Object sender, System.EventArgs e)
        {
            this.Close();
        }
        #endregion

    }
}
