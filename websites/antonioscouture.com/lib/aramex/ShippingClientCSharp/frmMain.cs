using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using ShippingClientCSharp.PrintLabel;
using ShippingClientCSharp.CreateShipments;
using ShippingClientCSharp.CreatePickup;
using ShippingClientCSharp.CancelPickup;

namespace ShippingClientCSharp
{
    public partial class frmMain : Form
    {
        public frmMain()
        {
            InitializeComponent();
        }

        private void btnCreateShipments_Click(object sender, EventArgs e)
        {
            using (Form1 _frmShipments = new Form1())
            {
                _frmShipments.ShowDialog(this);
            }
        }

        private void btnPrintLabel_Click(object sender, EventArgs e)
        {
            using (frmPrintLabel _frmLabel = new frmPrintLabel())
            {
                _frmLabel.ShowDialog(this);
            }
        }

        private void btnCreatePickup_Click(object sender, EventArgs e)
        {
            using (frmPickup _frmPickup = new frmPickup())
            {
                _frmPickup.ShowDialog(this);
            }
        }

        private void btnCancelPickup_Click(object sender, EventArgs e)
        {
            using (frmCancelPickup _frmCancelPickup = new frmCancelPickup())
            {
                _frmCancelPickup.ShowDialog(this);
            }
        }

        private void btnExit_Click(object sender, EventArgs e)
        {
            this.Close();
        }
    }
}
