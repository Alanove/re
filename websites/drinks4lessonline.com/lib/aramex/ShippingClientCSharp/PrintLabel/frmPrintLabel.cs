using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.ShippingReference;

namespace ShippingClientCSharp.PrintLabel
{
    public partial class frmPrintLabel : Form
    {
        public frmPrintLabel()
        {
            InitializeComponent();
        }

        private void frmPrintLabel_Load(object sender, EventArgs e)
        {
            rbReportAsURL.Checked = true;
            rbReportAsFile.Checked = false;
        }

        private void btnSubmitRequest_Click(object sender, EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            LabelPrintingRequest _Request = new LabelPrintingRequest();
            _Request.ClientInfo = new ClientInfo();
            _Request.ClientInfo.AccountCountryCode = txtAccountCountryCode.Text.Trim();
            _Request.ClientInfo.AccountEntity = txtAccountEntity.Text.Trim();
            _Request.ClientInfo.AccountNumber = txtAccountNumber.Text.Trim();
            _Request.ClientInfo.AccountPin = txtAccountPin.Text.Trim();
            _Request.ClientInfo.UserName = txtUsername.Text.Trim();
            _Request.ClientInfo.Password = txtPassword.Text.Trim();
            _Request.ClientInfo.Version = txtVersion.Text.Trim();

            _Request.Transaction = new Transaction();
            _Request.Transaction.Reference1 = txtReference1.Text.Trim();
            _Request.Transaction.Reference2 = txtReference2.Text.Trim();
            _Request.Transaction.Reference3 = txtReference3.Text.Trim();
            _Request.Transaction.Reference4 = txtReference4.Text.Trim();
            _Request.Transaction.Reference5 = txtReference5.Text.Trim();

            _Request.ShipmentNumber = txtShipmentNumber.Text.Trim();
            _Request.ProductGroup = txtProductGroup.Text.Trim();
            _Request.OriginEntity = txtOriginEntity.Text.Trim();

            _Request.LabelInfo = new LabelInfo();
            _Request.LabelInfo.ReportID = Convert.ToInt32(nudReportID.Value);
            if ((rbReportAsURL.Checked))
                _Request.LabelInfo.ReportType = "URL";
            if ((rbReportAsFile.Checked))
                _Request.LabelInfo.ReportType = "RPT";

            LabelPrintingResponse _Response = null;
            Service_1_0Client _Client = new Service_1_0Client();

            try
            {
                _Client.Open();
                _Response = _Client.PrintLabel(_Request);
                _Client.Close();

                using (frmPrintLabelCallResponse _frmPrintLabelCallResponse = new frmPrintLabelCallResponse())
                {
                    _frmPrintLabelCallResponse.Response = _Response;
                    _frmPrintLabelCallResponse.ReportType = _Request.LabelInfo.ReportType;
                    _frmPrintLabelCallResponse.ShowDialog(this);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
            }

            Cursor.Current = Cursors.Default;
        }

        private void btnReset_Click(object sender, EventArgs e)
        {
            Cursor.Current = Cursors.WaitCursor;

            txtShipmentNumber.Text = string.Empty;
            txtProductGroup.Text = string.Empty;
            txtOriginEntity.Text = string.Empty;

            Cursor.Current = Cursors.Default;
        }
    }
}
