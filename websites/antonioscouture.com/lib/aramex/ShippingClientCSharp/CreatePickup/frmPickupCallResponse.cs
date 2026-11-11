using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;

namespace ShippingClientCSharp.CreatePickup
{
    public partial class frmPickupCallResponse : Form
    {
        public frmPickupCallResponse()
        {
            InitializeComponent();
        }

        #region "Members"
        private PickupCreationResponse _Response = null;
        #endregion
        private string _ReportType = string.Empty;

        #region "Properties"
        public PickupCreationResponse Response
        {
            set { _Response = value; }
        }

        public string ReportType
        {
            set { _ReportType = value; }
        }
        #endregion

        #region "Methods"
        private void frmPickupCallResponse_Load(System.Object sender, System.EventArgs e)
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

            TreeNode _PickupNode = new TreeNode("Pickup");
            if ((_Response.ProcessedPickup != null))
            {
                _PickupNode.Nodes.Add(_Response.ProcessedPickup.ID);
                _PickupNode.Nodes.Add(_Response.ProcessedPickup.GUID.ToString());
                _PickupNode.Nodes.Add("Reference1 = '" + _Response.ProcessedPickup.Reference1 + "'");
                _PickupNode.Nodes.Add("Reference2 = '" + _Response.ProcessedPickup.Reference2 + "'");

                TreeNode _ShipmentsNode = new TreeNode("Shipments");
                if ((_Response.ProcessedPickup.ProcessedShipments != null && _Response.ProcessedPickup.ProcessedShipments.Length > 0))
                {
                    foreach (ProcessedShipment _Shipment in _Response.ProcessedPickup.ProcessedShipments)
                    {
                        TreeNode _ShipmentNode = new TreeNode(_Shipment.ID);
                        _ShipmentNode.Nodes.Add("Reference1 = '" + _Shipment.Reference1 + "'");
                        _ShipmentNode.Nodes.Add("Reference2 = '" + _Shipment.Reference2 + "'");
                        _ShipmentNode.Nodes.Add("Reference3 = '" + _Shipment.Reference3 + "'");
                        _ShipmentNode.Nodes.Add("ForeignHAWB = '" + _Shipment.ForeignHAWB + "'");
                        _ShipmentNode.Nodes.Add("HasErrors = '" + _Shipment.HasErrors.ToString() + "'");

                        TreeNode _ShipmentNodeNotifications = new TreeNode("Notifications");
                        if ((_Shipment.Notifications != null))
                        {
                            foreach (Notification _ShipmentNotification in _Shipment.Notifications)
                            {
                                TreeNode _ShipmentNotificationNode = new TreeNode("Notification");
                                _ShipmentNotificationNode.Nodes.Add("Code = '" + _ShipmentNotification.Code + "'");
                                _ShipmentNotificationNode.Nodes.Add("Message = '" + _ShipmentNotification.Message + "'");
                                _ShipmentNodeNotifications.Nodes.Add(_ShipmentNotificationNode);
                            }
                        }
                        _ShipmentNode.Nodes.Add(_ShipmentNodeNotifications);

                        TreeNode _ShipmentLabel = new TreeNode();
                        if ((_Shipment.ShipmentLabel == null))
                        {
                            _ShipmentLabel.Text = "No Label";
                            _ShipmentLabel.Tag = null;
                        }
                        else if ((!string.IsNullOrEmpty(_Shipment.ShipmentLabel.LabelURL) && _Shipment.ShipmentLabel.LabelFileContents == null))
                        {
                            _ShipmentLabel.Text = "Label URL";
                            _ShipmentLabel.Tag = _Shipment.ShipmentLabel.LabelURL;
                        }
                        else if ((string.IsNullOrEmpty(_Shipment.ShipmentLabel.LabelURL) && _Shipment.ShipmentLabel.LabelFileContents != null))
                        {
                            _ShipmentLabel.Text = "Label PDF File";
                            _ShipmentLabel.Tag = _Shipment.ShipmentLabel.LabelFileContents;
                        }
                        _ShipmentNode.Nodes.Add(_ShipmentLabel);

                        _ShipmentsNode.Nodes.Add(_ShipmentNode);
                    }

                    _PickupNode.Nodes.Add(_ShipmentsNode);
                }

            }

            TreeNode _RootNode = new TreeNode("Response");
            _RootNode.Nodes.Add(_TransactionNode);
            _RootNode.Nodes.Add(_HasErrorsNode);
            _RootNode.Nodes.Add(_NotificationsNode);
            _RootNode.Nodes.Add(_PickupNode);

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
