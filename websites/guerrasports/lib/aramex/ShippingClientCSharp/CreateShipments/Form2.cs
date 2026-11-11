using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;
using System.Diagnostics;
using System.Runtime.Serialization.Formatters.Binary;
using System.IO;

namespace ShippingClientCSharp.CreateShipments
{
    public partial class Form2 : Form
    {
        public Form2()
        {
            InitializeComponent();
        }

        #region "Members"
        private ShipmentCreationResponse _Response = null;
        #endregion

        #region "Properties"
        public ShipmentCreationResponse Response
        {
            set { _Response = value; }
        }
        #endregion

        #region "Methods"
        private void Form2_Load(System.Object sender, System.EventArgs e)
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

            TreeNode _ShipmentsNode = new TreeNode("Shipments");
            if ((_Response.Shipments != null && _Response.Shipments.Length > 0))
            {
                foreach (ProcessedShipment _Shipment in _Response.Shipments)
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
            }

            TreeNode _RootNode = new TreeNode("Response");
            _RootNode.Nodes.Add(_TransactionNode);
            _RootNode.Nodes.Add(_HasErrorsNode);
            _RootNode.Nodes.Add(_NotificationsNode);
            _RootNode.Nodes.Add(_ShipmentsNode);

            tvResponse.Nodes.Add(_RootNode);
            tvResponse.ExpandAll();
        }

        private void tvResponse_DoubleClick(object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            TreeNode _SelectedNode = tvResponse.SelectedNode;
            if ((_SelectedNode.Text.Equals("No Label")))
                return;

            switch (_SelectedNode.Text)
            {
                case "Label URL":
                    Process.Start(_SelectedNode.Tag.ToString());

                    break;
                case "Label PDF File":
                    string _TempPath = System.IO.Path.GetTempPath();
                    string _FileName = _TempPath + Guid.NewGuid().ToString() + ".pdf";
                    System.IO.File.WriteAllBytes(_FileName, ObjectToByteArray(_SelectedNode.Tag));
                    Process.Start(_FileName);
                    break;
            }

            Cursor.Current = Cursors.Default;
        }

        private byte[] ObjectToByteArray(Object obj)
        {
            if (obj == null)
                return null;
            BinaryFormatter bf = new BinaryFormatter();
            MemoryStream ms = new MemoryStream();
            bf.Serialize(ms, obj);
            return ms.ToArray();
        }

        private void btnExit_Click(System.Object sender, System.EventArgs e)
        {
            this.Close();
        }
        #endregion

    }
}
