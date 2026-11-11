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

namespace ShippingClientCSharp.PrintLabel
{
    public partial class frmPrintLabelCallResponse : Form
    {
        #region "Members"
        private LabelPrintingResponse _Response = null;
        #endregion
        private string _ReportType = string.Empty;

        #region "Properties"
        public LabelPrintingResponse Response
        {
            set { _Response = value; }
        }

        public string ReportType
        {
            set { _ReportType = value; }
        }
        #endregion

        #region "Methods"
        private void frmPrintLabelCallResponse_Load(System.Object sender, System.EventArgs e)
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

            TreeNode _ShipmentNumberNode = new TreeNode("ShipmentNumber = '" + _Response.ShipmentNumber + "'");

            TreeNode _RootNode = new TreeNode("Response");
            _RootNode.Nodes.Add(_TransactionNode);
            _RootNode.Nodes.Add(_HasErrorsNode);
            _RootNode.Nodes.Add(_NotificationsNode);
            _RootNode.Nodes.Add(_ShipmentNumberNode);
            if ((_Response.HasErrors == false))
            {
                if ((_Response.ShipmentLabel != null))
                {
                    TreeNode _ShipmentLabel = new TreeNode();
                    switch (_ReportType.Trim().ToUpper())
                    {
                        case "URL":
                            _ShipmentLabel.Text = "Label URL";
                            _ShipmentLabel.Tag = _Response.ShipmentLabel.LabelURL;

                            break;
                        case "RPT":
                            _ShipmentLabel.Text = "Label PDF File";
                            _ShipmentLabel.Tag = _Response.ShipmentLabel.LabelFileContents;
                            break;
                    }

                    _RootNode.Nodes.Add(_ShipmentLabel);
                }
            }

            tvResponse.Nodes.Add(_RootNode);
            tvResponse.ExpandAll();
        }

        private void tvResponse_DoubleClick(object sender, System.EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            TreeNode _SelectedNode = tvResponse.SelectedNode;

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

        private void btnExit_Click(System.Object sender, System.EventArgs e)
        {
            this.Close();
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
        #endregion

        public frmPrintLabelCallResponse()
        {
            InitializeComponent();
        }
    }
}
